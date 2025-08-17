"""
Asynchronous version of the Speedway‑Elitserien API server.

This module rewrites the original FastAPI server to use the asynchronous
Motor client instead of PyMongo. All database interactions are awaited,
making the endpoints non‑blocking. The public API remains largely the
same, but functions are refactored to return proper lists via async
cursors and to insert/update documents with `await`. Helper functions
for generating match heats are also made asynchronous where necessary.

To run this server, install `motor` and `fastapi`, then start with
`uvicorn server_async:app --reload`.

Note: This file is self‑contained and does not depend on the original
server implementation. Some of the more complex scraping logic has been
omitted for brevity; see the original repository for full details.
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import bcrypt
from helpers.schedule_elit import ELITSERIEN_2_15_7, COLOR_TO_TEAM, COLOR_TO_HELMET
from services.meta_rules import DEFAULT_RULES



# Environment variables and constants
# MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")  TESTAR INITIERA INUTI STARTUP
JWT_SECRET = os.environ.get("JWT_SECRET", "speedway-secret-key-2025")
JWT_ALGORITHM = "HS256"

# Initialize asynchronous MongoDB client and collections
# client = AsyncIOMotorClient(MONGO_URL)   TESTAR INITIERA INUTI STARTUP
# db = client["speedway_elitserien"]
# users_collection = db["users"]
# teams_collection = db["teams"]
# matches_collection = db["matches"]
# riders_collection = db["riders"]
# user_matches_collection = db["user_matches"]
# official_matches_collection = db["official_matches"]
# official_results_collection = db["official_results"]
# official_heats_collection = db["official_heats"]

client = None
db = None
users_collection = None
teams_collection = None
matches_collection = None
riders_collection = None
user_matches_collection = None
official_matches_collection = None
official_results_collection = None
official_heats_collection = None

# FastAPI app setup
app = FastAPI(title="Speedway Elitserien API (Async)")

client = None
db = None

FRONTEND_ORIGINS = [
    "http://localhost:3000",   # Vite/CRA dev
    # lägg till fler origins här vid behov
]

# Allow CORS from all origins (adjust in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,  
    allow_credentials=True,   # kräver att allow_origins INTE är "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security scheme
security = HTTPBearer()


###########################
# Helper and utility functions
###########################

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_jwt_token(user_id: str) -> str:
    """Create a JWT for the given user identifier."""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Verify a JWT token from the Authorization header and return the user_id.

    Raises an HTTPException if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_team_colors(team_position: str) -> List[str]:
    """
    Return standardized team colors.

    Home teams use red/blue; away teams use yellow/white.
    """
    if team_position == "home":
        return ["#DC2626", "#1D4ED8"]  # Red, Blue
    else:
        return ["#EAB308", "#FFFFFF"]  # Yellow, White
    
    
    # --- Team name resolver ------------------------------------------------------
CITY_SUFFIXES = {
    "målilla","malilla","hallstavik","motala","gislaved",
    "eskilstuna","norrköping","norrkoping","kumla","västervik","vastervik"
}

TEAM_ALIASES = {
    # normaliserade strängar -> kanoniskt teamnamn (normaliserat)
    "dackarna målilla": "dackarna",
    "dackarna malilla": "dackarna",
    "rospiggarna hallstavik": "rospiggarna",
    "piraterna motala": "piraterna",
    "lejonen gislaved": "lejonen",
    "smederna eskilstuna": "smederna",
    "vargarna norrköping": "vargarna",
    "vargarna norrkoping": "vargarna",
    "västervik västervik": "västervik",
    "vastervik vastervik": "västervik",
    # vanliga varianter
    "dackarna": "dackarna",
    "lejonen": "lejonen",
    "piraterna": "piraterna",
    "rospiggarna": "rospiggarna",
    "smederna": "smederna",
    "vargarna": "vargarna",
    "västervik": "västervik",
    "vastervik": "västervik",
    "indianerna": "indianerna",
}

def _norm(s: str) -> str:
    return (
        (s or "").lower()
        .encode("utf-8", "ignore")
        .decode("utf-8")
        .replace("å","a").replace("ä","a").replace("ö","o")
        .split()
    )

def _normalize_join(s: str) -> str:
    return " ".join(_norm(s))

def _strip_city_suffix(name: str) -> str:
    toks = _norm(name)
    if toks and toks[-1] in CITY_SUFFIXES:
        toks = toks[:-1]
    return " ".join(toks)

async def _build_team_index() -> dict:
    """
    Returnerar { normalized_name: team_doc } där normalized_name är både
    'namn' och 'namn+stad' varianter.
    """
    idx = {}
    async for t in teams_collection.find({}, {"_id":0}):
        base = _normalize_join(t["name"])
        idx[base] = t
        if t.get("city"):
            combo = _normalize_join(f"{t['name']} {t['city']}")
            idx[combo] = t
    return idx

def _simple_similarity(a: str, b: str) -> float:
    A, B = set(_norm(a)), set(_norm(b))
    if not A or not B: return 0.0
    inter = len(A & B)
    union = len(A | B)
    return inter / union

async def resolve_team_name(scraped_name: str) -> dict | None:
    """
    Försöker matcha scraped_name mot teams i DB.
    Returnerar team-doc vid träff, annars None.
    """
    idx = await _build_team_index()

    n = _normalize_join(scraped_name)
    if n in idx:  # exakt normaliserad träff
        return idx[n]

    # alias
    if n in TEAM_ALIASES and TEAM_ALIASES[n] in idx:
        return idx[TEAM_ALIASES[n]]

    # ta bort stadssuffix
    stripped = _strip_city_suffix(scraped_name)
    if stripped in idx: 
        return idx[stripped]
    if stripped in TEAM_ALIASES and TEAM_ALIASES[stripped] in idx:
        return idx[TEAM_ALIASES[stripped]]

    # prova första ordet (t.ex. "Dackarna Malilla" -> "dackarna")
    first = (n.split(" ")[0] if n else "")
    if first in idx: 
        return idx[first]
    if first in TEAM_ALIASES and TEAM_ALIASES[first] in idx:
        return idx[TEAM_ALIASES[first]]

    # enkel fuzzy som sista steg
    best_key, best_score = None, 0.0
    for key in idx.keys():
        sc = _simple_similarity(n, key)
        if sc > best_score:
            best_key, best_score = key, sc
    if best_key and best_score >= 0.6:
        return idx[best_key]

    return None

    
async def get_owned_match_or_403(matches_collection, match_id: str, user_id: str):
    match = await matches_collection.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    if match.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Inte behörig")
    return match


    # Antag att du har dessa Mongo-collections:
# matches_collection, teams_collection, riders_collection
# (om du saknar riders_collection, se fallback i get_team_roster)

def _list_duplicates(seq: List[str]) -> List[str]:
    seen, dups = set(), []
    for x in seq:
        if x in seen and x not in dups:
            dups.append(x)
        seen.add(x)
    return dups

def _heat_rider_ids(heat: Dict[str, Any]) -> List[str]:
    riders = heat.get("riders") or {}
    return [str(r.get("rider_id")) for r in riders.values()]

def has_duplicate_riders(heat: Dict[str, Any]) -> bool:
    ids = _heat_rider_ids(heat)
    return len(ids) != len(set(ids))

def validate_heat_unique_riders(heat: Dict[str, Any]) -> None:
    if not heat or "riders" not in heat:
        raise HTTPException(status_code=400, detail="Heat saknar riders.")
    ids = _heat_rider_ids(heat)
    dups = _list_duplicates(ids)
    if dups:
        hn = heat.get("heat_number")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Heat {hn} innehåller dublettförare: {', '.join(dups)}"
        )
        
        
        
# Recursively convert MongoDB ObjectId and other IDs to strings  ------- GPT TYCKTE DET        
        
def to_str_id(x):
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            if k in ("_id", "id"):
                out[k] = str(v)
            else:
                out[k] = to_str_id(v)
        return out
    elif isinstance(x, list):
        return [to_str_id(i) for i in x]
    else:
        return x
        


#SKA UPPDATERAS!

async def get_team_roster(team_id: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Returnerar {"mains":[...], "reserves":[...]} för angivet lag.
    Varje rider: {id, name, lineup_no, is_reserve}
    lineup_no hämtas från fältet "number" om det finns, annars faller vi tillbaka.
    """
    riders = await riders_collection.find({"team_id": team_id}, {"_id": 0}).to_list(length=None)
    mains: List[Dict[str, Any]] = []
    reserves: List[Dict[str, Any]] = []
    for r in riders:
        lineup_no = r.get("lineup_no") or r.get("number") or None
        item = {
            "id": str(r["id"]),
            "name": r.get("name", ""),
            "lineup_no": int(lineup_no) if lineup_no is not None else None,
            "is_reserve": bool(r.get("is_reserve", False)),
        }
        (reserves if item["is_reserve"] else mains).append(item)

    # sortera på lineup_no om möjligt
    mains.sort(key=lambda x: (x["lineup_no"] is None, x["lineup_no"]))
    reserves.sort(key=lambda x: (x["lineup_no"] is None, x["lineup_no"]))

    return {"mains": mains, "reserves": reserves}




#TSM MED GET_TEAM_ROSTER KODEN

def _pick_rider_by_lineup(roster: Dict[str, List[Dict[str, Any]]], num: int) -> Dict[str, Any]:
    if 1 <= num <= 5:
        xs = [r for r in roster["mains"] if int(r.get("lineup_no") or 0) == num]
        if xs: return xs[0]
    elif num in (6, 7):
        xs = [r for r in roster["reserves"] if int(r.get("lineup_no") or 0) == num]
        if xs: return xs[0]
    raise HTTPException(status_code=400, detail=f"Saknar förare med lineup_no {num}")



def _first_available(restrict_to: List[str], used: set) -> str | None:
    for rid in restrict_to:
        if str(rid) not in used:
            return str(rid)
    return None

def enforce_unique_riders_in_heat(
    heat: Dict[str, Any],
    home_roster: List[Dict[str, Any]],
    away_roster: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Ersätter ev. dublettförare med första lediga förare i samma lag.
    Uppdaterar även 'name' om det finns i truppen.
    """
    if not heat or "riders" not in heat:
        raise HTTPException(status_code=400, detail="Heat saknar riders.")

    # Bygg lookup för snabb tillgång till namn
    home_ids = [str(r["id"]) for r in home_roster if r.get("id") is not None]
    away_ids = [str(r["id"]) for r in away_roster if r.get("id") is not None]
    home_name = {str(r["id"]): r.get("name") for r in home_roster if r.get("id") is not None}
    away_name = {str(r["id"]): r.get("name") for r in away_roster if r.get("id") is not None}

    used: set = set()
    # Sortera gates så vi får deterministisk ordning (1,2,3,4)
    for gate in sorted(heat["riders"].keys(), key=lambda x: int(x)):
        entry = heat["riders"][gate]
        if not entry or "rider_id" not in entry or "team" not in entry:
            raise HTTPException(status_code=400, detail=f"Gate {gate} i heat {heat.get('heat_number')} saknar rider_id/team.")

        rid = str(entry["rider_id"])
        side = entry["team"]  # "home" | "away"

        if rid in used:
            # Dublett → välj första lediga inom samma lag
            if side == "home":
                replacement = _first_available(home_ids, used)
                if replacement is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Inga lediga förare i {side} för heat {heat.get('heat_number')}"
                    )
                entry["rider_id"] = replacement
                # sätt name om vi vet det
                if home_name.get(replacement):
                    entry["name"] = home_name[replacement]
                rid = replacement
            else:
                replacement = _first_available(away_ids, used)
                if replacement is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Inga lediga förare i {side} för heat {heat.get('heat_number')}"
                    )
                entry["rider_id"] = replacement
                if away_name.get(replacement):
                    entry["name"] = away_name[replacement]
                rid = replacement

        used.add(rid)

    # Sista koll – om något ändå dubblar, faila
    validate_heat_unique_riders(heat)
    return heat

def enforce_unique_riders_in_all_heats(
    heats: List[Dict[str, Any]],
    home_roster: List[Dict[str, Any]],
    away_roster: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    fixed: List[Dict[str, Any]] = []
    for h in heats:
        fixed.append(enforce_unique_riders_in_heat(h, home_roster, away_roster))
    return fixed
    
    
    
    
    
    
    

# ---------------------------------------------------------------------------
# 2025 Elitserien team rosters
# ---------------------------------------------------------------------------
# The following mapping defines the riders for each team in the 2025
# Elitserien season.  These values are taken from SVT's official
# roster list for Speedwayligan 2025【858643459566719†L135-L173】.  If the teams
# collection is empty at startup, these rosters will be inserted into
# the database automatically along with their corresponding teams.

ROSTERS_2025: Dict[str, List[str]] = {
    "Dackarna": [
        "Andzejs Lebedevs", "Avon Van Dyck", "Daniel Hauge Sjöström",
        "Frederik Jakobsen", "Jakub Krawczyk", "Nazar Parnicki",
        "Nicki Pedersen", "Rasmus Jensen", "Patrick Hansen",
        "Timo Lahti", "Thomas H Jonasson",
    ],
    "Indianerna": [
        "Alfred Åberg", "Bartlomiej Kowalski", "Bartosz Banbor", "Jonatan Grahn",
        "Krzysztof Buczkowski", "Luke Becker", "Patryk Dudek", "Rasmus Karlsson",
        "Szymon Wozniak", "Sebastian Szostak",
    ],
    "Lejonen": [
        "Alfons Wiltander", "Bartosz Zmarzlik", "Casper Henriksson", "Dominik Kubera",
        "Erik Persson", "Jaroslaw Hampel", "Mateusz Cierniak", "Kacper Woryna",
        "Oliver Berntzon", "Robert Chmiel", "Sammy Van Dyck",
    ],
    "Piraterna": [
        "Andreas Lyager", "Jonathan Ejnermark", "Ludvig Selvin", "Mathias Thörnblom",
        "Oskar Fajfer", "Oskar Paluch", "Przemysław Pawlicki", "Rohan Tungate",
        "Tim Sörensen", "Vaclav Milik",
    ],
    "Rospiggarna": [
        "Adam Ellis", "Artem Laguta", "Dante Johansson", "Eddie Bock",
        "Kai Huckenbeck", "Jonny Eriksson", "Ludvig Lindgren", "Vadim Tarasenko",
        "Ryan Douglas", "Sam Masters", "Villads Nagel", "Wiktor Przyjemski",
    ],
    "Smederna": [
        "Anton Jansson", "Ben Cook", "Jakub Jamrog", "Joel Andersson",
        "Kim Nilsson", "Maksym Drabik", "Mathias Pollestad", "Leon Madsen",
        "Philip Hellström Bängs",
    ],
    "Vargarna": [
        "Christoffer Selvin", "Filip Hjelmland", "Jakub Miskowiak", "Jaimon Lidsey",
        "Kevin Juhl Pedersen", "Marcin Nowak", "Niels-Kristian Iversen",
        "Tobiasz Musielak", "Oskar Polis", "Victor Palovaara",
    ],
    "Västervik": [
        "Anton Karlsson", "Adam Carlsson", "Bartosz Smektala", "Emil Millberg",
        "Fredrik Lindgren", "Jacob Thorssell", "Mads Hansen", "Matias Nielsen",
        "Noel Wahlquist", "Robert Lambert", "Tai Woffinden", "Tom Brennan",
    ],
}

# Mapping of team names to their home cities, used when seeding the database
TEAM_CITIES: Dict[str, str] = {
    "Dackarna": "Målilla",
    "Indianerna": "Kumla",
    "Lejonen": "Gislaved",
    "Piraterna": "Motala",
    "Rospiggarna": "Hallstavik",
    "Smederna": "Eskilstuna",
    "Vargarna": "Norrköping",
    "Västervik": "Västervik",
}

# async def seed_teams_and_riders() -> None:
#     """
#     Seed the database with teams and riders for the 2025 Elitserien season.

#     This function checks if the teams collection is empty and, if so,
#     inserts all teams listed in ROSTERS_2025 along with their riders into
#     the database.  Each rider will have a unique ID, reference its
#     team's ID via `team_id`, and include a sequential `number` field
#     based on the order in the roster.  The first six riders are
#     considered main riders (`is_reserve=False`) and the rest are
#     reserves (`is_reserve=True`).  Helmet colors are left blank; they
#     will be assigned dynamically in the heat generation.
#     """
#     # Only seed if no teams exist
#     existing_team_count = await teams_collection.count_documents({})
#     if existing_team_count > 0:
#         return
#     teams_to_insert: List[Dict[str, Any]] = []
#     riders_to_insert: List[Dict[str, Any]] = []
#     for team_name, rider_names in ROSTERS_2025.items():
#         team_id = str(uuid.uuid4())
#         teams_to_insert.append({
#             "id": team_id,
#             "name": team_name,
#             "city": TEAM_CITIES.get(team_name, ""),
#             "points": 0,
#             "matches_played": 0,
#         })
#         for idx, rider_name in enumerate(rider_names):
#             riders_to_insert.append({
#                 "id": str(uuid.uuid4()),
#                 "name": rider_name,
#                 "team_id": team_id,
#                 "number": idx + 1,
#                 "helmet_color": "",  # assigned during heat generation
#                 "is_reserve": idx >= 5,  # first 5 are main riders
#             })
#     if teams_to_insert:
#         await teams_collection.insert_many(teams_to_insert)
#     if riders_to_insert:
#         await riders_collection.insert_many(riders_to_insert)
#     return

import uuid
from typing import Dict, List, Any

async def seed_teams_and_riders() -> Dict[str, int]:
    """
#     Seed the database with teams and riders for the 2025 Elitserien season.

#     This function checks if the teams collection is empty and, if so,
#     inserts all teams listed in ROSTERS_2025 along with their riders into
#     the database.  Each rider will have a unique ID, reference its
#     team's ID via `team_id`, and include a sequential `number` field
#     based on the order in the roster.  The first five riders are
#     considered main riders (`is_reserve=False`) and the rest are
#     reserves (`is_reserve=True`).  Helmet colors are left blank; they
#     will be assigned dynamically in the heat generation.
#     """
    created_teams = 0
    inserted_riders = 0

    # 1) Hämta befintliga lag och bygg name -> id-map
    existing_teams = await teams_collection.find({}, {"id": 1, "name": 1}).to_list(length=None)
    team_id_by_name: Dict[str, str] = {t["name"]: t["id"] for t in existing_teams}

    # 2) Skapa saknade lag från ROSTERS_2025
    new_teams: List[Dict[str, Any]] = []
    for team_name in ROSTERS_2025.keys():
        if team_name not in team_id_by_name:
            team_id = str(uuid.uuid4())
            team_id_by_name[team_name] = team_id
            new_teams.append({
                "id": team_id,
                "name": team_name,
                "city": TEAM_CITIES.get(team_name, ""),
                "points": 0,
                "matches_played": 0,
            })

    if new_teams:
        res = await teams_collection.insert_many(new_teams)
        created_teams = len(res.inserted_ids)

    # 3) Lägg till saknade förare per lag
    riders_to_insert: List[Dict[str, Any]] = []
    for team_name, rider_names in ROSTERS_2025.items():
        team_id = team_id_by_name.get(team_name)
        if not team_id:
            continue  # borde inte hända, men skydd

        # vilka förare finns redan för det här laget?
        existing_riders = await riders_collection.find(
            {"team_id": team_id}, {"name": 1}
        ).to_list(length=None)
        existing_names = {r["name"] for r in existing_riders}

        for idx, rider_name in enumerate(rider_names):
            if rider_name in existing_names:
                continue
            riders_to_insert.append({
                "id": str(uuid.uuid4()),
                "name": rider_name,
                "team_id": team_id,
                "number": idx + 1,
                "helmet_color": "",        # sätts senare i heat-generation
                "is_reserve": idx >= 5,    # första 5 ordinarie
            })

    if riders_to_insert:
        res = await riders_collection.insert_many(riders_to_insert)
        inserted_riders = len(res.inserted_ids)

    return {"created_teams": created_teams, "inserted_riders": inserted_riders}



async def generate_default_heats(home_team_id: str, away_team_id: str) -> List[Dict[str, Any]]:
    """
    Generate heats when teams don't have enough riders.

    This function creates placeholder riders for 15 heats.
    """
    home_team = await teams_collection.find_one({"id": home_team_id})
    away_team = await teams_collection.find_one({"id": away_team_id})
    if not home_team or not away_team:
        raise HTTPException(status_code=404, detail="Team not found while generating default heats")

    home_colors = get_team_colors("home")
    away_colors = get_team_colors("away")

    heats: List[Dict[str, Any]] = []
    for i in range(1, 16):
        heat = {
            "heat_number": i,
            "riders": {
                "1": {
                    "rider_id": f"home_{i}_1",
                    "name": f"{home_team['name']} Förare {i}A",
                    "team": "home",
                    "helmet_color": home_colors[0],
                },
                "2": {
                    "rider_id": f"away_{i}_1",
                    "name": f"{away_team['name']} Förare {i}A",
                    "team": "away",
                    "helmet_color": away_colors[0],
                },
                "3": {
                    "rider_id": f"home_{i}_2",
                    "name": f"{home_team['name']} Förare {i}B",
                    "team": "home",
                    "helmet_color": home_colors[1],
                },
                "4": {
                    "rider_id": f"away_{i}_2",
                    "name": f"{away_team['name']} Förare {i}B",
                    "team": "away",
                    "helmet_color": away_colors[1],
                },
            },
            "results": [],
            "status": "upcoming",
            # The joker concept is no longer used in modern Swedish speedway.
            # The field is kept for backwards compatibility but remains unused.
            "joker_rider": None,
            "is_tactical_heat": i == 15,
        }
        heats.append(heat)
    return heats

# ---------------------------------------------------------------------------
# Note on placeholder heats
# ---------------------------------------------------------------------------
# The generate_default_heats() function above exists for backwards
# compatibility only.  In modern Elitserien rules we expect each team to
# register at least 5 regular riders plus 2 reserves in the database
# before matches are created.  As such, fallback to placeholder riders
# should be avoided.  The generate_match_heats() function (see below)
# checks if enough riders exist and will raise an exception instead of
# calling this fallback.



async def generate_match_heats(home_team_id: str, away_team_id: str, rules: Dict[str, Any]) -> List[Dict[str, Any]]:
    home = await get_team_roster(home_team_id)
    away = await get_team_roster(away_team_id)

    if len(home["mains"]) < 5 or len(away["mains"]) < 5:
        raise HTTPException(status_code=400, detail="Varje lag måste ha minst 5 ordinarie förare registrerade.")

    heats: List[Dict[str, Any]] = []

    for heat_no, g1, g2, g3, g4 in ELITSERIEN_2_15_7:
        
        # SUDDAR SÅLÄNGE; TESTAR KODEN UNDER
        # def parse(cell: str, gate: str) -> Dict[str, Any]:
        #     parts = cell.split("/")
        #     if len(parts) == 1:
        #         # t.ex. "R5"
        #         color = parts[0][0]
        #         num = int(parts[0][1:])
        #         team = COLOR_TO_TEAM[color]
        #         rider = _pick_rider_by_lineup(home if team=="home" else away, num)
        #         return {
        #             "rider_id": str(rider["id"]),
        #             "name": rider["name"],
        #             "team": team,
        #             "helmet_color": COLOR_TO_HELMET[color],
        #             "lineup_no": num,
        #             "is_reserve": bool(rider.get("is_reserve", num in (6, 7))),
        #             # ”Reservernas 3 schemalagda heat är låsta”
        #             "locked": bool(num in (6, 7)),
        #         }
        #     else:
        #         # nominering (heat 14–15) – placeholder, sätts efter heat 13
        #         colorA, colorB = parts[0], parts[1]
        #         team = COLOR_TO_TEAM[colorA]
        #         return {
        #             "rider_id": None,
        #             "name": None,
        #             "team": team,
        #             "helmet_color": None,
        #             "lineup_no": None,
        #             "is_reserve": False,
        #             "locked": False,
        #             "color_choices": [COLOR_TO_HELMET[colorA], COLOR_TO_HELMET[colorB]],
        #         }
        
        
        #TEST 
        def parse(cell: str, gate: str) -> Dict[str, Any]:
        # "R5" => en specifik ordinarie/reserv enligt lineup_no
            if "/" not in cell:
                color = cell[0]
                num = int(cell[1:])
                team_key = COLOR_TO_TEAM[color]  # "home" för R/B, "away" för G/V
                rider = _pick_rider_by_lineup(home if team_key == "home" else away, num)
                return {
                "rider_id": str(rider["id"]),
                "name": rider["name"],
                "team": team_key,
                "helmet_color": COLOR_TO_HELMET[color],
                "lineup_no": num,
                "is_reserve": bool(rider.get("is_reserve", num in (6, 7))),
                "locked": bool(num in (6, 7)),  # reservernas schemalagda heat är låsta
                }   

        # Nominering (14–15): cell t.ex. "V/R" eller "B/G"
        # Här sätter vi INTE team; det görs först när nomineringen skickas in.
            c1, c2 = cell.split("/")
            return {
                "rider_id": None,
                "name": None,
                "team": None,                 # ← viktigt: inget lag bestämt här
                "helmet_color": None,         # sätts vid nominering
                "lineup_no": None,
                "is_reserve": False,
                "locked": False,
                # spara färgbokstäverna så vi kan mappa till team/färg sen
                "color_choices": [c1, c2],    # t.ex. ["V","R"] eller ["G","B"]
            }

        riders = {
            "1": parse(g1, "1"),
            "2": parse(g2, "2"),
            "3": parse(g3, "3"),
            "4": parse(g4, "4"),
        }

        heats.append({
            "heat_number": heat_no,
            "riders": riders,
            "results": [],
            "status": "upcoming",
        })

    return heats






#KOMMENTERAR UT DETTA SÅ LÄNGE, SKA FUNKA TSM MED NYA GET_TEAM_ROSTER ----------------------KODEN ÖVER

# async def generate_match_heats(home_team_id: str, away_team_id: str) -> List[Dict[str, Any]]:
#     """
#     Generate the 15 predetermined heats for a speedway match.

#     This version fetches riders asynchronously. If insufficient riders exist,
#     fallback to default heats.
#     """
#     # Fetch up to 5 main riders and 2 reserve for each team
#     home_riders = await riders_collection.find({"team_id": home_team_id, "is_reserve": False}).to_list(length=5)
#     home_reserve = await riders_collection.find_one({"team_id": home_team_id, "is_reserve": True})
#     away_riders = await riders_collection.find({"team_id": away_team_id, "is_reserve": False}).to_list(length=5)
#     away_reserve = await riders_collection.find_one({"team_id": away_team_id, "is_reserve": True})

#     # If either team has fewer than 5 registered riders (excluding reserves),
#     # we cannot construct a valid heat program.  According to modern
#     # Elitserien rules, matches must be composed using the registered
#     # riders for each team.  Therefore, raise an error to prompt the
#     # administrator to seed the riders collection properly instead of
#     # falling back to placeholder riders.
#     if len(home_riders) < 5 or len(away_riders) < 5:
#         raise HTTPException(
#             status_code=400,
#             detail=(
#                 "Insufficient riders for one or both teams; each team must have at least "
#                 "5 registered riders plus 2 reserves in the database before creating a match."
#             ),
#         )

#     # Predefined gate assignments for 15 heats
#     heat_program = [
#         {"heat": 1, "gates": {"1": 0, "2": 0, "3": 1, "4": 1}},
#         {"heat": 2, "gates": {"1": 1, "2": 2, "3": 0, "4": 2}},
#         {"heat": 3, "gates": {"1": 2, "2": 1, "3": 3, "4": 0}},
#         {"heat": 4, "gates": {"1": 3, "2": 3, "3": 2, "4": 4}},
#         {"heat": 5, "gates": {"1": 4, "2": 0, "3": 5, "4": 3}},
#         {"heat": 6, "gates": {"1": 5, "2": 5, "3": 4, "4": 1}},
#         {"heat": 7, "gates": {"1": 0, "2": 4, "3": 1, "4": 5}},
#         {"heat": 8, "gates": {"1": 1, "2": 3, "3": 2, "4": 0}},
#         {"heat": 9, "gates": {"1": 2, "2": 2, "3": 3, "4": 3}},
#         {"heat": 10, "gates": {"1": 3, "2": 1, "3": 4, "4": 2}},
#         {"heat": 11, "gates": {"1": 4, "2": 5, "3": 5, "4": 4}},
#         {"heat": 12, "gates": {"1": 5, "2": 0, "3": 0, "4": 1}},
#         {"heat": 13, "gates": {"1": 0, "2": 2, "3": 1, "4": 3}},
#         {"heat": 14, "gates": {"1": 1, "2": 4, "3": 2, "4": 5}},
#         {"heat": 15, "gates": {"1": 2, "2": 1, "3": 3, "4": 0}},
#     ]

#     home_colors = get_team_colors("home")
#     away_colors = get_team_colors("away")

#     heats: List[Dict[str, Any]] = []
#     for heat_info in heat_program:
#         heat: Dict[str, Any] = {
#             "heat_number": heat_info["heat"],
#             "riders": {},
#             "results": [],
#             "status": "upcoming",
#             "joker_rider": None,
#             "is_tactical_heat": heat_info["heat"] == 15,
#         }
#         for gate, rider_index in heat_info["gates"].items():
#             gate_int = int(gate)
#             if gate_int in (1, 3):  # Home team gates
#                 if rider_index < len(home_riders):
#                     color_index = 0 if gate_int == 1 else 1
#                     rider = home_riders[rider_index]
#                     heat["riders"][gate] = {
#                         "rider_id": rider["id"],
#                         "name": rider["name"],
#                         "team": "home",
#                         "helmet_color": home_colors[color_index],
#                     }
#             else:  # Away team gates (2, 4)
#                 if rider_index < len(away_riders):
#                     color_index = 0 if gate_int == 2 else 1
#                     rider = away_riders[rider_index]
#                     heat["riders"][gate] = {
#                         "rider_id": rider["id"],
#                         "name": rider["name"],
#                         "team": "away",
#                         "helmet_color": away_colors[color_index],
#                     }
#         heats.append(heat)
        
        
#         # --- Lägg in garantin här ---
#     home_roster = await get_team_roster(home_team_id)
#     away_roster = await get_team_roster(away_team_id)
#     if not home_roster or not away_roster:
#         raise HTTPException(status_code=400, detail="Saknar komplett lagtrupp för home/away.")

#     heats = enforce_unique_riders_in_all_heats(heats, home_roster, away_roster)
#     return heats


###########################
# Pydantic models
###########################

class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class HeatResult(BaseModel):
    heat_number: int
    results: List[dict]
    # The joker field is removed since the joker rule is not used.
    
    
class ResolveTeamIn(BaseModel):
    name: str
    
class CreateFromOfficialIn(BaseModel):
    official_match_id: str   


###########################
# Startup event: seed sample data
###########################

@app.on_event("startup")
async def startup_event() -> None:
    """
    Application startup hook to seed teams and riders if necessary.

    At startup, this function invokes `seed_teams_and_riders()` to populate
    the `teams` and `riders` collections with the official rosters for the
    2025 Elitserien season.  If any teams already exist in the database,
    the seeding process is skipped.  This ensures that your application
    always has a full set of teams and riders to work with and avoids
    reliance on placeholder data.
    """
    global client, db
    global users_collection, teams_collection, matches_collection
    global riders_collection, user_matches_collection
    global official_matches_collection, official_results_collection, official_heats_collection

    mongo_url = os.getenv("MONGO_URL")  # Example: mongodb+srv://user:pw@cluster.mongodb.net/

    # Important parameters added here:
    client = AsyncIOMotorClient(mongo_url)

    db = client["speedway_elitserien"]

    users_collection = db["users"]
    teams_collection = db["teams"]
    matches_collection = db["matches"]
    riders_collection = db["riders"]
    user_matches_collection = db["user_matches"]
    official_matches_collection = db["official_matches"]
    official_results_collection = db["official_results"]
    official_heats_collection = db["official_heats"]
    
    # await seed_teams_and_riders()  KÖRA I EGEN ENDPOINT /API/SEED?
    
    
@app.post("/api/seed")
async def run_seed():
    await seed_teams_and_riders()
    return {"status": "ok"}
    
    
@app.post("/api/teams/resolve")
async def api_resolve_team(payload: ResolveTeamIn) -> Dict[str, Any]:
    team = await resolve_team_name(payload.name)
    if not team:
        raise HTTPException(status_code=404, detail="Kunde inte matcha lag")
    return {"team_id": team["id"], "team_name": team["name"], "city": team.get("city","")}


###########################
# Authentication endpoints
###########################

@app.post("/api/auth/register")
async def register(user_data: UserRegister) -> Dict[str, Any]:
    """
    Register a new user. Returns a JWT and user data on success.
    Raises HTTP 400 if the username or email already exists.
    """
    # Ensure DB and collections are initialised
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not initialised yet")
    existing = await users_collection.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]}, 
                                               session=None)
    if existing:
        raise HTTPException(status_code=400, detail="Användare finns redan")
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": datetime.utcnow(),
    }
    await users_collection.insert_one(user_doc, session=None)
    token = create_jwt_token(user_id)
    return {"token": token, "user": {"id": user_id, "username": user_data.username, "email": user_data.email}}


@app.post("/api/auth/login")
async def login(user_data: UserLogin) -> Dict[str, Any]:
    """
    Log in a user with username and password. Returns a JWT on success.
    Raises HTTP 401 if credentials are invalid.
    """
    user = await users_collection.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Felaktiga inloggningsuppgifter")
    token = create_jwt_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "email": user["email"]}}


###########################
# Team endpoints
###########################

@app.get("/api/teams")
async def get_teams() -> List[Dict[str, Any]]:
    """Return all teams sorted by points descending."""
    teams_cursor = teams_collection.find({}, {"_id": 0})
    teams = await teams_cursor.to_list(length=None)
    teams.sort(key=lambda t: t.get("points", 0), reverse=True)
    return teams


@app.get("/api/teams/{team_id}")
async def get_team(team_id: str) -> Dict[str, Any]:
    """Return a specific team by id."""
    team = await teams_collection.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Lag hittades inte")
    return team


# @app.get("/api/teams/{team_id}/riders")
# async def get_team_riders(team_id: str) -> List[Dict[str, Any]]:
#     """Return all riders belonging to a team."""
#     riders_cursor = riders_collection.find({"team_id": team_id}, {"_id": 0})
#     riders = await riders_cursor.to_list(length=None)
#     return riders

#UPPDATERAD
@app.get("/api/teams/{team_id}/riders")
async def get_team_riders(team_id: str) -> Dict[str, Any]:
    """
    Returnerar truppen uppdelad i mains(1–5) och reserves(6–7).
    Varje rider har: id, name, team_id, lineup_no, is_reserve.
    """
    cur = riders_collection.find({"team_id": team_id}, {"_id": 0})
    xs = await cur.to_list(length=None)

    def to_item(r):
        # finns både "number" och ev. "lineup_no" i din DB – normalisera:
        lineup_no = r.get("lineup_no") or r.get("number")
        return {
            "id": str(r["id"]),
            "name": r["name"],
            "team_id": r["team_id"],
            "lineup_no": int(lineup_no) if lineup_no else None,
            "is_reserve": bool(r.get("is_reserve", False)),
        }

    mains = [to_item(r) for r in xs if not r.get("is_reserve", False)]
    reserves = [to_item(r) for r in xs if r.get("is_reserve", False)]

    # säkra sort: mains efter lineup_no 1..5, reserves 6..7
    mains.sort(key=lambda r: (r["lineup_no"] is None, r["lineup_no"]))
    reserves.sort(key=lambda r: (r["lineup_no"] is None, r["lineup_no"]))

    return {"mains": mains, "reserves": reserves}


# ---------------------------------------------------------------------------
# Riders endpoints
# ---------------------------------------------------------------------------

@app.get("/api/riders")
async def get_all_riders() -> List[Dict[str, Any]]:
    """
    Return a list of all riders across all teams.

    Varje rider-dokument inkluderar sina identifierande fält och det
    associerade team_id. För lag-specifika listor finns redan
    `/api/teams/{team_id}/riders`.
    """
    riders_cursor = riders_collection.find({}, {"_id": 0})
    riders = await riders_cursor.to_list(length=None)
    return riders


###########################
# Match endpoints
###########################

@app.get("/api/matches")
async def get_matches() -> List[Dict[str, Any]]:
    """
    Return all matches with human‑friendly team names and optional official_match_id.
    """
    matches_cursor = matches_collection.find({}, {"_id": 0})
    matches = await matches_cursor.to_list(length=None)
    # Enrich with team names
    for match in matches:
        home_team = await teams_collection.find_one({"id": match["home_team_id"]})
        away_team = await teams_collection.find_one({"id": match["away_team_id"]})
        match["home_team"] = home_team["name"] if home_team else "Okänt lag"
        match["away_team"] = away_team["name"] if away_team else "Okänt lag"
        match.setdefault("official_match_id", None)
    return matches

# @app.get("/api/matches")
# async def get_matches(user_id: str = Depends(verify_jwt_token)) -> List[Dict[str, Any]]:
#     """
#     Return all matches created by the authenticated user, with human‑friendly team names.
#     """
#     matches_cursor = matches_collection.find({"created_by": user_id}, {"_id": 0})
#     matches = await matches_cursor.to_list(length=None)
#     # Enrich with team names
#     for match in matches:
#         home_team = await teams_collection.find_one({"id": match["home_team_id"]})
#         away_team = await teams_collection.find_one({"id": match["away_team_id"]})
#         match["home_team"] = home_team["name"] if home_team else "Okänt lag"
#         match["away_team"] = away_team["name"] if away_team else "Okänt lag"
#         match.setdefault("official_match_id", None)
#     return matches

# @app.get("/api/matches")
# async def get_matches(user_id: str = Depends(verify_jwt_token)):
#     # Om du vill lista BARA den inloggades matcher:
#     matches_cursor = matches_collection.find({"created_by": user_id}, {"_id": 0})
#     matches = await matches_cursor.to_list(length=None)
#     # enricha namn
#     for match in matches:
#         home = await teams_collection.find_one({"id": match["home_team_id"]}, {"_id": 0, "name": 1})
#         away = await teams_collection.find_one({"id": match["away_team_id"]}, {"_id": 0, "name": 1})
#         match["home_team"] = home["name"] if home else "Okänt lag"
#         match["away_team"] = away["name"] if away else "Okänt lag"
#         match.setdefault("official_match_id", None)
#     return matches

#-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# @app.post("/api/matches")
# async def create_match(match_data: Dict[str, Any], user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
#     """
#     Create a new match with 15 predetermined heats. A user cannot create
#     duplicate matches for the same teams and date.
#     """
#     # Normalize the date and check for duplicates
#     match_date = datetime.fromisoformat(match_data["date"].replace("Z", "+00:00"))
#     existing = await matches_collection.find_one({
#         "created_by": user_id,
#         "home_team_id": match_data["home_team_id"],
#         "away_team_id": match_data["away_team_id"],
#         "date": match_date,
#     })
#     if existing:
#         raise HTTPException(status_code=400, detail="Du har redan lagt till den här matchen.")

#     match_id = str(uuid.uuid4())
#     heats = await generate_match_heats(match_data["home_team_id"], match_data["away_team_id"])
#     match_doc = {
#         "id": match_id,
#         "home_team_id": match_data["home_team_id"],
#         "away_team_id": match_data["away_team_id"],
#         "date": match_date,
#         "venue": match_data.get("venue", ""),
#         "status": "upcoming",
#         "home_score": 0,
#         "away_score": 0,
#         "heats": heats,
#         "created_by": user_id,
#         "created_at": datetime.utcnow(),
#         "official_match_id": match_data.get("official_match_id"),
#     }
#     await matches_collection.insert_one(match_doc)
#     return {"message": "Match skapad med förbestämda heat", "match_id": match_id}


# NY @app.post("/api/matches") MED META.RULES
@app.post("/api/matches")
async def create_match(match_data: Dict[str, Any], user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    match_date = datetime.fromisoformat(match_data["date"].replace("Z", "+00:00"))

    existing = await matches_collection.find_one({
        "created_by": user_id,
        "home_team_id": match_data["home_team_id"],
        "away_team_id": match_data["away_team_id"],
        "date": match_date,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Du har redan lagt till den här matchen.")

    match_id = str(uuid.uuid4())

    # 👉 SKICKA IN DEFAULT_RULES HÄR
    heats = await generate_match_heats(
        match_data["home_team_id"],
        match_data["away_team_id"],
        DEFAULT_RULES,
    )

    match_doc = {
        "id": match_id,
        "home_team_id": match_data["home_team_id"],
        "away_team_id": match_data["away_team_id"],
        "date": match_date,
        "venue": match_data.get("venue", ""),
        "status": "upcoming",
        "home_score": 0,
        "away_score": 0,
        "heats": heats,
        "created_by": user_id,
        "created_at": datetime.utcnow(),
        "official_match_id": match_data.get("official_match_id"),
        # 👉 SPARA REGLERNA PÅ MATCHEN
        "meta": {"rules": DEFAULT_RULES},
    }
    await matches_collection.insert_one(match_doc)
    return {"message": "Match skapad med förbestämda heat", "match_id": match_id}



# @app.get("/api/matches/{match_id}")
# async def get_match(match_id: str) -> Dict[str, Any]:
#     """Return a specific match by id, enriched with team names."""
#     match = await matches_collection.find_one({"id": match_id}, {"_id": 0})
#     if not match:
#         raise HTTPException(status_code=404, detail="Match hittades inte")
#     home_team = await teams_collection.find_one({"id": match["home_team_id"]})
#     away_team = await teams_collection.find_one({"id": match["away_team_id"]})
#     match["home_team"] = home_team["name"] if home_team else "Okänt lag"
#     match["away_team"] = away_team["name"] if away_team else "Okänt lag"
#     return match

@app.get("/api/matches/{match_id}")
async def get_match(match_id: str, user_id: str = Depends(verify_jwt_token)):
    match = await get_owned_match_or_403(matches_collection, match_id, user_id)

    # enricha namn, men fortsätt utan _id:
    home = await teams_collection.find_one({"id": match["home_team_id"]}, {"_id": 0, "name": 1})
    away = await teams_collection.find_one({"id": match["away_team_id"]}, {"_id": 0, "name": 1})
    match["home_team"] = home["name"] if home else "Okänt lag"
    match["away_team"] = away["name"] if away else "Okänt lag"

    # säkerhetsbälte: ta bort _id om det ändå skulle slinka med
    match.pop("_id", None)
    match.setdefault("meta", {}).setdefault("rules", DEFAULT_RULES)
    return match



@app.delete("/api/matches/{match_id}")
async def delete_match(match_id: str, user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """
    Delete a match that the authenticated user created.
    Raises HTTP 404 if not found and 403 if created by another user.
    """
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    if match.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Inte behörig att ta bort den här matchen")
    await matches_collection.delete_one({"id": match_id})
    return {"message": "Match borttagen"}


# UPDATEAD GÄLLER

@app.put("/api/matches/{match_id}/heat/{heat_number}/riders")
async def update_heat_riders(
    match_id: str,
    heat_number: int,
    rider_assignments: Dict[str, str],
    user_id: str = Depends(verify_jwt_token),
) -> Dict[str, Any]:
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    if match.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Inte behörig")

    # validera enligt reglerna (TR, lås, lag, limits)
    await validate_heat_rider_change(match, heat_number, rider_assignments)

    # hitta heat
    heats = match["heats"]
    for i, h in enumerate(heats):
        if h.get("heat_number") == heat_number:
            current_heat = h
            break
    else:
        raise HTTPException(status_code=404, detail="Heat hittades inte")

    # skriv byten – färger enligt gate
    for gate, new_rider_id in rider_assignments.items():
        gate_int = int(gate)
        expected_team = "home" if gate_int in (1, 3) else "away"
        rider = await riders_collection.find_one({"id": new_rider_id})
        colors = get_team_colors(expected_team)
        color_index = 0 if gate_int in (1, 2) else 1
        current_heat["riders"][gate] = {
            "rider_id": rider["id"],
            "name": rider["name"],
            "team": expected_team,
            "helmet_color": colors[color_index],
        }

    heats[i] = current_heat
    await matches_collection.update_one({"id": match_id}, {"$set": {"heats": heats}})
    return {"message": "Heat-uppställning uppdaterad", "heat": current_heat}



@app.put("/api/matches/{match_id}/heat/{heat_number}/result")
async def update_heat_result(match_id: str, heat_number: int, result_data: Dict[str, Any], user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """
    Update the result of a single heat within a match. Calculates points
    for each rider according to Swedish Elitserien rules (3‑2‑1‑0 per heat) and
    assigns bonus points for riders finishing second in a 5‑1 heat or third
    in a 3‑3 heat. Bonus points are stored per rider but do not contribute
    to the team totals. The deprecated joker logic is ignored.
    """
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")

    # if not match:
    #     raise HTTPException(status_code=404, detail="Match hittades inte")
    # Locate the heat to update
    heat_index = None
    for i, heat in enumerate(match["heats"]):
        if heat["heat_number"] == heat_number:
            heat_index = i
            break
    if heat_index is None:
        raise HTTPException(status_code=404, detail="Heat hittades inte")
    # Points mapping (standard 3‑2‑1‑0)
    points_map = {1: 3, 2: 2, 3: 1, 4: 0}
    updated_results: List[Dict[str, Any]] = []
    home_points = 0
    away_points = 0
    # Map rider_id to its team for quick lookup
    rider_team_map: Dict[str, str] = {}
    for gate, rider_info in match["heats"][heat_index]["riders"].items():
        rider_team_map[rider_info["rider_id"]] = rider_info["team"]
    # Process each result entry
    for result in result_data.get("results", []):
        pts = 0
        pos = result.get("position", 0)
        status = result.get("status", "completed")
        if status == "completed":
            pts = points_map.get(pos, 0)
        elif status == "excluded":
            pts = 0
        updated_results.append({
            "rider_id": result["rider_id"],
            "position": pos,
            "points": pts,
            "status": status,
            # bonus_points will be filled later
        })
        # Tally team points (bonus not included)
        team = rider_team_map.get(result["rider_id"])
        if team == "home":
            home_points += pts
        elif team == "away":
            away_points += pts
    # Assign bonus points based on heat result pattern
    # Sort results by position ascending (1–4)
    sorted_results = sorted(updated_results, key=lambda r: r.get("position", 0))
    if len(sorted_results) == 4:
        team_pos1 = rider_team_map.get(sorted_results[0]["rider_id"])
        team_pos2 = rider_team_map.get(sorted_results[1]["rider_id"])
        team_pos3 = rider_team_map.get(sorted_results[2]["rider_id"])
        # Check for 5‑1 scenario: positions 1 and 2 from same team
        if team_pos1 == team_pos2:
            # Assign bonus to rider in 2nd position
            sorted_results[1]["bonus_points"] = 1
        # Check for 3‑3 scenario: positions 2 and 3 from same team
        elif team_pos2 == team_pos3:
            sorted_results[2]["bonus_points"] = 1
    # Ensure bonus_points defaults to 0 for all riders
    for res in updated_results:
        res.setdefault("bonus_points", 0)
    # Persist updated results and scores
    match["heats"][heat_index]["results"] = updated_results
    match["heats"][heat_index]["status"] = "completed"
    # Joker logic is ignored; do not update joker fields
    match["home_score"] += home_points
    match["away_score"] += away_points
    await matches_collection.update_one(
        {"id": match_id},
        {"$set": {
            "heats": match["heats"],
            "home_score": match["home_score"],
            "away_score": match["away_score"],
        }}
    )
    return {
        "message": "Heat resultat uppdaterat",
        "home_points": home_points,
        "away_points": away_points,
        "heat_results": updated_results,
    }
    
    
    
def _team_scores_upto(match: Dict[str, Any], upto_heat: int) -> tuple[int,int]:
    home = away = 0
    for h in match["heats"]:
        hn = h.get("heat_number")
        if not isinstance(hn, int) or hn >= upto_heat:
            continue
        for res in h.get("results", []):
            pts = int(res.get("points", 0))
            rid = res.get("rider_id")
            team = None
            for e in h.get("riders", {}).values():
                if e.get("rider_id") == rid:
                    team = e.get("team")
                    break
            if team == "home": home += pts
            elif team == "away": away += pts
    return home, away    
    
# NYE NDPOITN /VALIDERING FÖR NOMINERINGAR TILL HEAT 14 OCH 15    
# 3) Validering vid byten (PUT /heat/{n}/riders)
# 
# Säkerställ server-side:
# 
# Samma lag: gate 1/3 får endast bytas till hemförare, gate 2/4 till bortalag.
# 
# Lås reserver: om riders[gate].locked är True → forbid ändring (utom när RR är aktivt och du uttryckligen tillåter).
# 
# TR-villkor (heats 5–13, underläge ≥6): max 1 byte per heat.
async def validate_heat_rider_change(
    match: Dict[str, Any],
    heat_number: int,
    rider_assignments: Dict[str, str],
) -> None:
    heats = match["heats"]
    heat = next((h for h in heats if h.get("heat_number") == heat_number), None)
    if not heat:
        raise HTTPException(status_code=404, detail="Heat hittades inte")

    # 1) Gates 1/3 = home, 2/4 = away + rätt lag för vald förare
    home_team_id = match["home_team_id"]
    away_team_id = match["away_team_id"]
    for gate, new_rider_id in rider_assignments.items():
        gate_int = int(gate)
        expected_team = "home" if gate_int in (1, 3) else "away"
        rider = await riders_collection.find_one({"id": new_rider_id})
        if not rider:
            raise HTTPException(status_code=404, detail=f"Förare {new_rider_id} hittades inte")
        if expected_team == "home" and rider.get("team_id") != home_team_id:
            raise HTTPException(status_code=400, detail=f"Gate {gate}: Endast hemförare får väljas")
        if expected_team == "away" and rider.get("team_id") != away_team_id:
            raise HTTPException(status_code=400, detail=f"Gate {gate}: Endast bortalagsförare får väljas")

    # 2) Låsta reserv-heat
    for gate, entry in heat["riders"].items():
        if entry.get("locked") and gate in rider_assignments:
            raise HTTPException(status_code=400, detail=f"Gate {gate}: Reservens schemalagda heat är låst")

    # 3) Taktisk reserv-regler (från match.meta.rules)
    rules = (match.get("meta") or {}).get("rules") or {}
    tr = rules.get("tactical", {})
    t_enabled = tr.get("enabled", True)
    t_start = tr.get("start_heat", 5)
    t_end = tr.get("end_heat", 13)
    t_min_def = tr.get("min_deficit", 6)
    t_max_per_heat = tr.get("max_per_heat", 1)

    if not (t_enabled and t_start <= heat_number <= t_end):
        raise HTTPException(status_code=400, detail="Endast heats 5–13 kan ändras enligt TR-regeln")

    # måste ligga under med minst t_min_def före heatet
    home_score, away_score = _team_scores_upto(match, heat_number)
    diff = abs(home_score - away_score)
    losing_team = "home" if home_score < away_score else ("away" if away_score < home_score else None)
    if losing_team is None or diff < t_min_def:
        raise HTTPException(status_code=400, detail=f"TR tillåten endast vid underläge ≥ {t_min_def} p")

    # max 1 byte per heat
    changes = 0
    for gate, new_rider_id in rider_assignments.items():
        if new_rider_id != heat["riders"][gate]["rider_id"]:
            changes += 1
    if changes > t_max_per_heat:
        raise HTTPException(status_code=400, detail=f"Max {t_max_per_heat} byte tillåtet per heat enligt TR")

    # 4) Ride-limits (enkelt tak: ordinarie max 6, reserv max 5)
    rider_heat_counts: Dict[str, int] = {}
    for h in heats:
        for e in h.get("riders", {}).values():
            rid = e.get("rider_id")
            if rid:
                rider_heat_counts[rid] = rider_heat_counts.get(rid, 0) + 1

    # simulera byten
    for gate, new_rider_id in rider_assignments.items():
        old_rider_id = heat["riders"][gate]["rider_id"]
        if old_rider_id != new_rider_id:
            rider_heat_counts[old_rider_id] = max(0, rider_heat_counts.get(old_rider_id, 1) - 1)
            rider_heat_counts[new_rider_id] = rider_heat_counts.get(new_rider_id, 0) + 1

    for rid, cnt in rider_heat_counts.items():
        rider = await riders_collection.find_one({"id": rid})
        if not rider: 
            continue
        is_reserve = bool(rider.get("is_reserve", False))
        max_heats = 5 if is_reserve else 6
        if cnt > max_heats:
            nm = rider.get("name", rid)
            raise HTTPException(status_code=400, detail=f"{nm} överskrider max antal heat ({max_heats})")



# FUNKTIONER FÖR NOMINATIONS ENDPOINTEN:
def _sum_scores_by_rider(match: Dict[str, Any]) -> Dict[str, int]:
    """
    Summerar poäng (inkl. bonus_points) per rider_id för hela matchen.
    """
    scores: Dict[str, int] = {}
    for h in match.get("heats", []):
        for res in h.get("results", []):
            rid = res.get("rider_id")
            if not rid:
                continue
            pts = int(res.get("points", 0)) + int(res.get("bonus_points", 0))
            scores[rid] = scores.get(rid, 0) + pts
    return scores

async def _fetch_team_riders_map(team_id: str) -> Dict[str, Dict[str, Any]]:
    """
    returnerar { rider_id: rider_doc }
    """
    xs = await riders_collection.find({"team_id": team_id}, {"_id": 0}).to_list(length=None)
    return { str(x["id"]): x for x in xs }

def _ride_limit_for(rider_doc: Dict[str, Any]) -> int:
    # enkel limit: ordinarie=6, reserv=5
    return 5 if bool(rider_doc.get("is_reserve", False)) else 6

def _current_heat_counts(match: Dict[str, Any]) -> Dict[str, int]:
    """
    Räkna hur många heats varje rider är **uppsatt** i (alla heats).
    """
    counts: Dict[str, int] = {}
    for h in match.get("heats", []):
        for e in (h.get("riders") or {}).values():
            rid = e.get("rider_id")
            if rid:
                counts[rid] = counts.get(rid, 0) + 1
    return counts

def _gate_order_for_team_in_heat(heat: Dict[str, Any], team: str) -> list[tuple[str, dict]]:
    """
    Returnerar [(gate, entry), ...] för de gates i detta heat som tillhör 'team'
    i stigande gate-ordning, dvs två stycken.
    """
    pairs = []
    for g in sorted((heat.get("riders") or {}).keys(), key=lambda x: int(x)):
        entry = heat["riders"][g]
        if entry.get("team") == team:
            pairs.append((g, entry))
    return pairs  # för h14/h15 bör detta vara två st

def _top3_of_team_mains(scores_map: Dict[str,int], riders_map: Dict[str,Dict[str,Any]]) -> list[str]:
    """
    Returnerar rider_ids för lagets ordinarie sorterade på poäng (desc).
    Om 3:e plats är delad, inkluderas alla med score >= score för #3.
    """
    mains = [rid for rid,doc in riders_map.items() if not doc.get("is_reserve", False)]
    ranked = sorted(mains, key=lambda rid: scores_map.get(rid, 0), reverse=True)
    if len(ranked) <= 3:
        return ranked
    # threshold = score för tredjeplatsen
    third_score = scores_map.get(ranked[2], 0)
    return [rid for rid in ranked if scores_map.get(rid, 0) >= third_score]

def _assign_nomination_to_gates(heat: Dict[str, Any], team: str, rider_ids: list[str], team_colors: list[str]) -> None:
    """
    Skriver in två rider_ids på teamets två gates i heatet, sätter hjälmfärg enligt
    gate:ens color_choices om de finns, annars standard team-färg (index 0/1).
    """
    gates = _gate_order_for_team_in_heat(heat, team)  # [(gate, entry), (gate, entry)]
    if len(gates) != 2:
        raise HTTPException(status_code=400, detail=f"Heat {heat.get('heat_number')}: oväntat antal gates för {team}")
    if len(rider_ids) != 2:
        raise HTTPException(status_code=400, detail=f"Heat {heat.get('heat_number')}: exakt 2 förare måste nomineras för {team}")

    for i, (gate, entry) in enumerate(gates):
        rid = rider_ids[i]
        # välj hjälmfärg: om color_choices finns (från schemat) -> ta i:te färgen modulo 2
        color = None
        choices = entry.get("color_choices")
        if isinstance(choices, list) and choices:
            color = choices[i % len(choices)]
        else:
            # fallback: standard teamfärg (0 för första team-gaten, 1 för andra)
            color = team_colors[0 if i == 0 else 1]

        heat["riders"][gate] = {
            "rider_id": rid,
            "name": None,  # fylls av klienten vid render eller kan hämtas separat; ej nödvändigt här
            "team": team,
            "helmet_color": color,
        }
            
# NY ENDPOITN NOMINATIONS FÖR NYA KODEN MED REGLER OCH  SCHEDULA_ELIT FILERNA 

# SUDDAR SÅLÄNGE OCH TESTAR NY KOD UNDER
# @app.put("/api/matches/{match_id}/nominations")
# async def update_nominations(
#     match_id: str,
#     nominations: Dict[str, Dict[str, list[str]]] = Body(...),
#     user_id: str = Depends(verify_jwt_token),
# ) -> Dict[str, Any]:
#     """
#     Uppdatera nomineringar för heat 14 och/eller 15, för **båda lag**.

#     Body:
#     {
#       "heat14": {"home": [id1,id2], "away": [id3,id4]},
#       "heat15": {"home": [id5,id6], "away": [id7,id8]}
#     }

#     Regler:
#     - Måste göras **efter** att heat 1–13 är completed.
#     - Heat 14: fritt val bland lagets registrerade förare (hem/ borta).
#     - Heat 15: 2 av lagets 3 poängbästa **ordinarie** (inkl. bonus). Vid tie på 3:e plats
#                får alla med score >= tredjeplatsens score anses vara "i topp-3".
#     - Ride-limits: nomineringen får inte göra att en förare passerar sin gräns
#                    (ordinarie 6, reserv 5).
#     - Färger: hämtas från heatets `riders[gate].color_choices` om den finns, annars
#               lagets standardfärger per gate-ordning.
#     """
#     match = await matches_collection.find_one({"id": match_id})
#     if not match:
#         raise HTTPException(status_code=404, detail="Match hittades inte")
#     if match.get("created_by") != user_id:
#         raise HTTPException(status_code=403, detail="Inte behörig")

#     # Säkerställ att heat 1–13 är klara
#     completed_1_13 = sum(1 for h in match.get("heats", []) if 1 <= h.get("heat_number", 0) <= 13 and h.get("status") == "completed")
#     if completed_1_13 < 13:
#         raise HTTPException(status_code=400, detail="Nominering kan endast göras efter heat 13 är klart")

#     # Hitta heat 14 och 15
#     heat14 = next((h for h in match["heats"] if h.get("heat_number") == 14), None)
#     heat15 = next((h for h in match["heats"] if h.get("heat_number") == 15), None)
#     if not heat14 or not heat15:
#         raise HTTPException(status_code=400, detail="Match saknar heat 14/15")

#     # Räkna poäng per förare (inkl bonus)
#     scores_map = _sum_scores_by_rider(match)

#     # Hämta lagens rider-maps
#     home_id = match["home_team_id"]
#     away_id = match["away_team_id"]
#     home_riders_map = await _fetch_team_riders_map(home_id)
#     away_riders_map = await _fetch_team_riders_map(away_id)

#     # Ride-limits – utgångsläge (innan nomineringen)
#     base_counts = _current_heat_counts(match)

#     # Hjälp för validering / gräns-koll
#     def ensure_team_and_exists(rids: list[str], team: str):
#         riders_map = home_riders_map if team == "home" else away_riders_map
#         bad = [rid for rid in rids if rid not in riders_map]
#         if bad:
#             raise HTTPException(status_code=400, detail=f"{team}: okända förare: {', '.join(bad)}")

#     # ------------- HEAT 15: top-2-av-top-3 per lag -------------
#     if "heat15" in nominations:
#         for team in ("home", "away"):
#             ids = nominations["heat15"].get(team) or []
#             if len(ids) != 2:
#                 raise HTTPException(status_code=400, detail=f"heat15/{team}: exakt 2 förare krävs")
#             ensure_team_and_exists(ids, team)

#             riders_map = home_riders_map if team == "home" else away_riders_map
#             topset = set(_top3_of_team_mains(scores_map, riders_map))
#             # Alla nominerade måste tillhöra top-3-mängden (med tie-upplösning)
#             if not set(ids).issubset(topset):
#                 raise HTTPException(status_code=400, detail=f"heat15/{team}: nominering måste vara 2 av lagets poängmässigt 3 bästa ordinarie förare")

#     # ------------- HEAT 14: fri nominering per lag -------------
#     if "heat14" in nominations:
#         for team in ("home", "away"):
#             ids = nominations["heat14"].get(team) or []
#             if len(ids) != 2:
#                 raise HTTPException(status_code=400, detail=f"heat14/{team}: exakt 2 förare krävs")
#             ensure_team_and_exists(ids, team)

#     # ------------- Ride-limit-koll (kombinerad effekt av båda heaten) -------------
#     # Simulera ökningar: varje nominerad förare får +1 heat per heat han/ hon nomineras i.
#     increments: Dict[str, int] = {}
#     for hkey in ("heat14", "heat15"):
#         if hkey not in nominations:
#             continue
#         for team in ("home", "away"):
#             for rid in nominations[hkey].get(team, []):
#                 increments[rid] = increments.get(rid, 0) + 1

#     # Validera mot limits
#     for rid, inc in increments.items():
#         # vilken map?
#         doc = home_riders_map.get(rid) or away_riders_map.get(rid)
#         if not doc:
#             continue
#         limit = _ride_limit_for(doc)
#         current = base_counts.get(rid, 0)
#         if current + inc > limit:
#             nm = doc.get("name", rid)
#             raise HTTPException(status_code=400, detail=f"Nominering skulle överskrida heat-tak för {nm} ({current}+{inc} > {limit})")

#     # ------------- Skriv in nomineringarna i heat 14/15 -------------
#     # Färger: i h14/h15 innehåller rider-entries ofta "color_choices": ["V", "R"] eller liknande planterat av generatorn.
#     home_colors = get_team_colors("home")
#     away_colors = get_team_colors("away")

#     if "heat14" in nominations:
#         # Skriv hem och borta enligt heatets gate->team (bestäms av schemat)
#         _assign_nomination_to_gates(heat14, "home", nominations["heat14"]["home"], home_colors)
#         _assign_nomination_to_gates(heat14, "away", nominations["heat14"]["away"], away_colors)

#     if "heat15" in nominations:
#         _assign_nomination_to_gates(heat15, "home", nominations["heat15"]["home"], home_colors)
#         _assign_nomination_to_gates(heat15, "away", nominations["heat15"]["away"], away_colors)

#     # Persistera
#     await matches_collection.update_one(
#         {"id": match_id},
#         {"$set": {"heats": match["heats"]}}
#     )

#     return {"message": "Nomineringar uppdaterade"}

@app.put("/api/matches/{match_id}/nominations")
async def update_nominations(
    match_id: str,
    nominations: Dict[str, Dict[str, list[str]]],  # {heat14:{home:[],away:[]}, heat15:{home:[],away:[]}}
    user_id: str = Depends(verify_jwt_token),
) -> Dict[str, Any]:
    """
    Body (exempel):
    {
      "heat14": { "home": ["h1","h2"], "away": ["a1","a2"] },
      "heat15": { "home": ["hTop1","hTop2"], "away": ["aTop1","aTop2"] }
    }
    """
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")

    # Endast ägaren får uppdatera
    if match.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Inte behörig")

    # 1) Kontroll: 1–13 måste vara completed
    completed = sum(1 for h in match["heats"] if h.get("status") == "completed")
    if completed < 13:
        raise HTTPException(status_code=400, detail="Nominering kan endast göras efter heat 13")

    home_id = match["home_team_id"]
    away_id = match["away_team_id"]

    # 2) Plocka riders per lag
    home_riders_all = await riders_collection.find({"team_id": home_id}).to_list(length=None)
    away_riders_all = await riders_collection.find({"team_id": away_id}).to_list(length=None)
    id_set_home = {r["id"] for r in home_riders_all}
    id_set_away = {r["id"] for r in away_riders_all}

    # 3) Hämta ordinarie (is_reserve=False) för top-3-beräkningen
    home_mains = [r for r in home_riders_all if not r.get("is_reserve", False)]
    away_mains = [r for r in away_riders_all if not r.get("is_reserve", False)]
    home_main_ids = {r["id"] for r in home_mains}
    away_main_ids = {r["id"] for r in away_mains}

    # 4) Räkna poäng (inkl bonus) per rider_id
    rider_scores: Dict[str, int] = {}
    for h in match["heats"]:
        for res in h.get("results", []):
            rid = res.get("rider_id")
            if not rid:
                continue
            pts = int(res.get("points", 0)) + int(res.get("bonus_points", 0))
            rider_scores[rid] = rider_scores.get(rid, 0) + pts

    def top3_of_team(main_ids: set[str]) -> list[str]:
        xs = [(rid, rider_scores.get(rid, 0)) for rid in main_ids]
        xs.sort(key=lambda t: t[1], reverse=True)
        return [rid for rid, _ in xs[:3]]

    home_top3 = top3_of_team(home_main_ids)
    away_top3 = top3_of_team(away_main_ids)

    # 5) Validera inkommande struktur
    for key in ("heat14", "heat15"):
        if key not in nominations or not isinstance(nominations[key], dict):
            raise HTTPException(status_code=400, detail=f"Saknar {key} i body")
        for side in ("home", "away"):
            if side not in nominations[key] or len(nominations[key][side]) != 2:
                raise HTTPException(status_code=400, detail=f"{key}: förväntar exakt 2 förare för {side}")

    h14_home = nominations["heat14"]["home"]
    h14_away = nominations["heat14"]["away"]
    h15_home = nominations["heat15"]["home"]
    h15_away = nominations["heat15"]["away"]

    # 6) Lagtillhörighet
    if not set(h14_home).issubset(id_set_home): raise HTTPException(status_code=400, detail="Heat 14: home innehåller förare som inte tillhör hemmalaget")
    if not set(h14_away).issubset(id_set_away): raise HTTPException(status_code=400, detail="Heat 14: away innehåller förare som inte tillhör bortalaget")
    if not set(h15_home).issubset(id_set_home): raise HTTPException(status_code=400, detail="Heat 15: home innehåller förare som inte tillhör hemmalaget")
    if not set(h15_away).issubset(id_set_away): raise HTTPException(status_code=400, detail="Heat 15: away innehåller förare som inte tillhör bortalaget")

    # 7) Heat 15-regel: 2 av lagets 3 poängbästa ordinarie
    if not set(h15_home).issubset(set(home_top3)) or not set(h15_away).issubset(set(away_top3)):
        raise HTTPException(status_code=400, detail="Heat 15 måste vara 2 av lagets 3 poängbästa ordinarie (inkl bonus) för respektive lag")

    # 8) Applicera nomineringar på rätt gate/färg
    # Mönster enligt tabellen:
    #  Heat 14: gate1=(away,V), gate2=(home,R), gate3=(away,G), gate4=(home,B)
    #  Heat 15: gate1=(home,R), gate2=(away,V), gate3=(home,B), gate4=(away,G)

    def assign_nomination(heat_num: int, home_ids: list[str], away_ids: list[str]) -> None:
        # Hämta heat
        heat = next((h for h in match["heats"] if h.get("heat_number") == heat_num), None)
        if not heat:
            raise HTTPException(status_code=404, detail=f"Heat {heat_num} hittades inte")

        # Hämta fulla rider-objekt i rätt ordning (2 per lag)
        def get_riders(ids: list[str], pool: list[dict]) -> list[dict]:
            mp = {r["id"]: r for r in pool}
            return [mp[i] for i in ids]

        H = get_riders(home_ids, home_riders_all)
        A = get_riders(away_ids, away_riders_all)

        if heat_num == 14:
            pattern = {
                "1": ("away", "V"),
                "2": ("home", "R"),
                "3": ("away", "G"),
                "4": ("home", "B"),
            }
        else:  # 15
            pattern = {
                "1": ("home", "R"),
                "2": ("away", "V"),
                "3": ("home", "B"),
                "4": ("away", "G"),
            }

        # Lägg ut enligt pattern – bevara ordningen i listorna
        # home går på de gates där pattern[x][0] == "home", i given ordning
        # away likadant
        home_iter = iter(H)
        away_iter = iter(A)
        new_riders = {}

        for gate, (who, color_letter) in pattern.items():
            if who == "home":
                r = next(home_iter)
                new_riders[gate] = {
                    "rider_id": r["id"],
                    "name": r["name"],
                    "team": "home",
                    "helmet_color": COLOR_TO_HELMET[color_letter],
                }
            else:
                r = next(away_iter)
                new_riders[gate] = {
                    "rider_id": r["id"],
                    "name": r["name"],
                    "team": "away",
                    "helmet_color": COLOR_TO_HELMET[color_letter],
                }

        heat["riders"] = new_riders
        # Nominering sätter inte heatets status/resultat

    assign_nomination(14, h14_home, h14_away)
    assign_nomination(15, h15_home, h15_away)

    await matches_collection.update_one({"id": match_id}, {"$set": {"heats": match["heats"]}})
    return {"message": "Nomineringar uppdaterade"}









# CONFIRM

@app.put("/api/matches/{match_id}/confirm")
async def confirm_match(match_id: str, user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """
    Confirm a completed match and store it in the user's matches. Compares
    results with official results if available and marks discrepancies.
    """
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")

    # if not match:
    #     raise HTTPException(status_code=404, detail="Match hittades inte")
    # Ensure all heats are completed
    completed_heats = sum(1 for heat in match["heats"] if heat.get("status") == "completed")
    if completed_heats < 15:
        raise HTTPException(status_code=400, detail=f"Endast {completed_heats}/15 heat är avslutade")
    # Mark match as confirmed
    await matches_collection.update_one({"id": match_id}, {"$set": {"status": "confirmed"}})
    user_match_id = str(uuid.uuid4())
    user_match: Dict[str, Any] = {
        "id": user_match_id,
        "user_id": user_id,
        "match_id": match_id,
        "user_results": {
            "home_score": match["home_score"],
            "away_score": match["away_score"],
            "heats": match["heats"],
        },
        "status": "completed",
        "completed_at": datetime.utcnow(),
    }
    # Try to fetch official results and compare
    home_team = await teams_collection.find_one({"id": match["home_team_id"]})
    away_team = await teams_collection.find_one({"id": match["away_team_id"]})
    # Here we call the scraper. In this asynchronous version, the scraper should
    # ideally be asynchronous too. As a placeholder, we call a dummy function.
    official_results = await scrape_official_results(
        home_team["name"] if home_team else "", 
        away_team["name"] if away_team else "", 
        match["date"].strftime("%Y-%m-%d"),
    )
    if official_results:
        user_match["official_results"] = official_results
        discrepancies: List[Dict[str, Any]] = []
        if abs(match["home_score"] - official_results.get("home_score", 0)) > 0:
            discrepancies.append({
                "type": "home_score",
                "user_value": match["home_score"],
                "official_value": official_results.get("home_score", 0),
            })
        if abs(match["away_score"] - official_results.get("away_score", 0)) > 0:
            discrepancies.append({
                "type": "away_score",
                "user_value": match["away_score"],
                "official_value": official_results.get("away_score", 0),
            })
        if discrepancies:
            user_match["discrepancies"] = discrepancies
            user_match["status"] = "disputed"
    await user_matches_collection.insert_one(user_match)
    return {
        "message": "Match bekräftad och sparad",
        "user_match_id": user_match_id,
        "discrepancies": user_match.get("discrepancies", []),
    }


@app.get("/api/user/matches")
async def get_user_matches(user_id: str = Depends(verify_jwt_token)) -> List[Dict[str, Any]]:
    """
    Return all matches completed by the user, enriched with team names,
    and compute discrepancy/validation status compared to official results.
    """
    user_matches_cursor = user_matches_collection.find({"user_id": user_id}, {"_id": 0})
    user_matches = await user_matches_cursor.to_list(length=None)
    for user_match in user_matches:
        match = await matches_collection.find_one({"id": user_match["match_id"]})
        if not match:
            continue
        home_team = await teams_collection.find_one({"id": match["home_team_id"]})
        away_team = await teams_collection.find_one({"id": match["away_team_id"]})
        user_match["match_details"] = {
            "home_team": home_team["name"] if home_team else "Okänt lag",
            "away_team": away_team["name"] if away_team else "Okänt lag",
            "date": match.get("date"),
            "venue": match.get("venue", ""),
        }
        official_match_id = match.get("official_match_id")
        if official_match_id:
            official = await official_matches_collection.find_one({"id": official_match_id})
            if official and "home_score" in official and "away_score" in official:
                discrepancies: List[Dict[str, Any]] = []
                if user_match["user_results"].get("home_score") != official.get("home_score"):
                    discrepancies.append({
                        "type": "home_score",
                        "user_value": user_match["user_results"].get("home_score"),
                        "official_value": official.get("home_score"),
                    })
                if user_match["user_results"].get("away_score") != official.get("away_score"):
                    discrepancies.append({
                        "type": "away_score",
                        "user_value": user_match["user_results"].get("away_score"),
                        "official_value": official.get("away_score"),
                    })
                if discrepancies:
                    user_match["status"] = "disputed"
                    user_match["discrepancies"] = discrepancies
                else:
                    user_match["status"] = "validated"
                    user_match["discrepancies"] = []
                # Always include official results if present
                user_match["official_results"] = {
                    "home_score": official.get("home_score"),
                    "away_score": official.get("away_score"),
                }
            else:
                # No official score available
                user_match["status"] = "complete"
                user_match["discrepancies"] = []
        else:
            user_match["status"] = "complete"
            user_match["discrepancies"] = []
    return user_matches


@app.put("/api/user/matches/{user_match_id}/resolve")
async def resolve_discrepancy(user_match_id: str, resolution_data: Dict[str, Any], user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """
    Resolve discrepancies for a user match by either accepting official results
    or keeping user results. Updates the user match document accordingly.
    """
    user_match = await user_matches_collection.find_one({"id": user_match_id, "user_id": user_id})
    if not user_match:
        raise HTTPException(status_code=404, detail="Användarens match hittades inte")
    match = await matches_collection.find_one({"id": user_match["match_id"]})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    action = resolution_data.get("action")
    if action == "accept_official":
        official_match_id = match.get("official_match_id")
        if official_match_id:
            official = await official_matches_collection.find_one({"id": official_match_id})
            if official and "home_score" in official and "away_score" in official:
                user_match["user_results"]["home_score"] = official.get("home_score")
                user_match["user_results"]["away_score"] = official.get("away_score")
                user_match["status"] = "validated"
                user_match["discrepancies"] = []
            else:
                raise HTTPException(status_code=400, detail="Officiella poäng saknas")
        else:
            raise HTTPException(status_code=400, detail="Ingen officiell match kopplad")
    elif action == "keep_user":
        user_match["status"] = "validated"
        user_match["discrepancies"] = []
    else:
        raise HTTPException(status_code=400, detail="Ogiltig åtgärd")
    await user_matches_collection.update_one(
        {"id": user_match_id},
        {"$set": {
            "user_results": user_match["user_results"],
            "status": user_match["status"],
            "discrepancies": user_match.get("discrepancies", []),
            "resolved_at": datetime.utcnow(),
        }}
    )
    return {"message": "Konflikt löst"}


###########################
# Official data endpoints
###########################

@app.put("/api/official-matches/{match_id}/mark-used")
async def mark_match_as_used(match_id: str, user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """Mark an official match as used so it is no longer available for selection."""
    result = await official_matches_collection.update_one({"id": match_id}, {"$set": {"used": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Matchen hittades inte")
    return {"message": "Match markerad som använd"}


@app.get("/api/official-matches")
async def get_official_matches(user_id: str = Depends(verify_jwt_token)) -> List[Dict[str, Any]]:
    """Return all official matches that have not yet been used by any user."""
    matches_cursor = official_matches_collection.find({"used": {"$ne": True}}, {"_id": 0})
    matches = await matches_cursor.to_list(length=None)
    matches.sort(key=lambda m: m.get("date"))
    return matches


@app.post("/api/admin/import-official-matches")
async def import_official_matches() -> Dict[str, Any]:
    """
    Import official matches from an external source (e.g. flashscore). This
    asynchronous implementation assumes that the scraping function returns a
    list of match dictionaries. Each new match is inserted if it does not
    already exist. Returns the number of matches imported and the total
    fetched.
    """
    try:
        from scraping.flashscore import fetch_official_speedway_matches_async  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import error: {e}")
    try:
        matches = await fetch_official_speedway_matches_async()  # synchronous function returns list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraper error: {e}")
    added = 0
    for match in matches:
        exists = await official_matches_collection.find_one({
            "home_team": match["home_team"],
            "away_team": match["away_team"],
            "date": match["date"],
        })
        if not exists:
            await official_matches_collection.insert_one(match)
            added += 1
    return {"imported_matches": added, "fetched": len(matches)}



# @app.post("/api/admin/import-official-matches")
# async def import_official_matches() -> Dict[str, Any]:
#     """
#     Hämtar officiella matcher/heat via asynkron Playwright-scrape (svemo.py)
#     och sparar dem i MongoDB. Upsert på competition_id.
#     """
#     try:
#         # Viktigt: importera din ASYNC-funktion
#         from scraping.svemo import fetch_all_svemo_heats  # type: ignore
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Import error: {e}")

#     try:
#         # Viktigt: AWAITA asynkron funktion
#         matches = await fetch_all_svemo_heats()  # -> List[Dict]
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Scraper error: {e}")

#     if not matches:
#         return {"imported": 0, "fetched": 0}

#     inserted = 0
#     upserted = 0

#     for m in matches:
#         # m innehåller: id, competition_id, source_url, scraped_at, heats
#         # Vi gör upsert baserat på competition_id
#         res = await official_matches_collection.update_one(
#             {"competition_id": m["competition_id"]},
#             {"$set": m, "$setOnInsert": {"created_at": m.get("scraped_at")}},
#             upsert=True,
#         )
#         if res.upserted_id:
#             inserted += 1
#         elif res.modified_count > 0:
#             upserted += 1

#     return {
#         "fetched": len(matches),
#         "inserted_new": inserted,
#         "updated_existing": upserted,
#     }



@app.post("/api/admin/sync-teams-from-official")
async def sync_teams_from_official() -> Dict[str, Any]:
    """
    Sync teams from official matches into the teams collection. Adds any
    teams present in official matches but missing from the teams
    collection. Returns the number of teams added.
    """
    official_cursor = official_matches_collection.find()
    official_teams: set[str] = set()
    async for m in official_cursor:
        official_teams.add(m["home_team"].strip())
        official_teams.add(m["away_team"].strip())
    added = 0
    for name in official_teams:
        exists = await teams_collection.find_one({"name": name})
        if not exists:
            new_team = {
                "id": str(uuid.uuid4()),
                "name": name,
                "city": "",
                "points": 0,
                "matches_played": 0,
            }
            await teams_collection.insert_one(new_team)
            added += 1
    return {"message": f"{added} lag tillagda i teams"}



# BE CHATGPT MED RULES OCHJ META SOM I VANLIGA CREATE_MATCH

@app.post("/api/matches/from-official")
async def create_match_from_official(
    body: CreateFromOfficialIn,
    user_id: str = Depends(verify_jwt_token)
):
    official = await official_matches_collection.find_one({"id": body.official_match_id})
    if not official:
        raise HTTPException(status_code=404, detail="Official match saknas")

    home = await resolve_team_name(official["home_team"])
    away = await resolve_team_name(official["away_team"])
    if not home or not away:
        raise HTTPException(status_code=400, detail="Kunde inte matcha lag mot databasen")

    match_date = datetime.fromisoformat(
        official["date"].replace("Z","+00:00")
    ) if "Z" in official["date"] else datetime.fromisoformat(official["date"])

    existing = await matches_collection.find_one({
        "created_by": user_id,
        "home_team_id": home["id"],
        "away_team_id": away["id"],
        "date": match_date
    })
    if existing:
        return {"message": "Match fanns redan", "match_id": existing["id"]}

    # 👉 SKICKA IN DEFAULT_RULES HÄR
    heats: List[Dict[str, Any]] = await generate_match_heats(
        home["id"],
        away["id"],
        DEFAULT_RULES,
    )

    # (valfritt) säkerhetssanering om du kör den:
    # home_roster = await get_team_roster(home["id"])
    # away_roster = await get_team_roster(away["id"])
    # heats = enforce_unique_riders_in_all_heats(heats, home_roster, away_roster)

    match_id = str(uuid.uuid4())
    match_doc = {
        "id": match_id,
        "home_team_id": home["id"],
        "away_team_id": away["id"],
        "date": match_date,
        "venue": "",
        "status": "upcoming",
        "home_score": 0,
        "away_score": 0,
        "heats": heats,
        "created_by": user_id,
        "created_at": datetime.utcnow(),
        "official_match_id": official["id"],
        # 👉 SPARA REGLERNA PÅ MATCHEN
        "meta": {"rules": DEFAULT_RULES},
    }
    await matches_collection.insert_one(match_doc)
    return {"message":"Match skapad från official", "match_id": match_id}



@app.post("/api/admin/import-official-heats")
async def import_official_heats() -> Dict[str, Any]:
    """
    Import official heats from the SVEMO scraper. Deduplicates by
    competition_id and reports the number of added records as well as
    those skipped due to missing competition_id or duplication.
    """
    try:
        from scraping.svemo import fetch_all_svemo_heats  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import error: {e}")
    try:
        heats_data = await fetch_all_svemo_heats()  # asynchronous scraper
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraper error: {e}")
    added = 0
    skipped_no_comp = 0
    duplicates = 0
    total_processed = 0
    for heat_doc in heats_data:
        total_processed += 1
        comp_id = heat_doc.get("competition_id")
        if not comp_id:
            skipped_no_comp += 1
            continue
        exists = await official_heats_collection.find_one({"competition_id": comp_id})
        if exists:
            duplicates += 1
            continue
        await official_heats_collection.insert_one(heat_doc)
        added += 1
    return {
        "message": f"{added} heatmatcher importerade",
        "fetched": len(heats_data),
        "skipped_no_competition_id": skipped_no_comp,
        "duplicates": duplicates,
        "total_processed": total_processed,
    }


###########################
# Placeholder scraper function
###########################

async def scrape_official_results(home_team: str, away_team: str, date: str) -> Optional[Dict[str, Any]]:
    """
    Placeholder for the official result scraping. In a production system,
    replace this with an asynchronous implementation that fetches
    official scores from a service like Flashscore. Returns a dict
    containing home_score and away_score or None if unavailable.
    """
    # Return None to indicate no official results available.
    return None


@app.get("/api/health")
async def health_check() -> Dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok", "service": "Speedway Elitserien API (Async)"}

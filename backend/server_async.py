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

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import bcrypt

# Environment variables and constants
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
JWT_SECRET = os.environ.get("JWT_SECRET", "speedway-secret-key-2025")
JWT_ALGORITHM = "HS256"

# Initialize asynchronous MongoDB client and collections
client = AsyncIOMotorClient(MONGO_URL)
db = client["speedway_elitserien"]
users_collection = db["users"]
teams_collection = db["teams"]
matches_collection = db["matches"]
riders_collection = db["riders"]
user_matches_collection = db["user_matches"]
official_matches_collection = db["official_matches"]
official_results_collection = db["official_results"]
official_heats_collection = db["official_heats"]

# FastAPI app setup
app = FastAPI(title="Speedway Elitserien API (Async)")

# Allow CORS from all origins (adjust in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


async def generate_match_heats(home_team_id: str, away_team_id: str) -> List[Dict[str, Any]]:
    """
    Generate the 15 predetermined heats for a speedway match.

    This version fetches riders asynchronously. If insufficient riders exist,
    fallback to default heats.
    """
    # Fetch up to 6 main riders and one reserve for each team
    home_riders = await riders_collection.find({"team_id": home_team_id, "is_reserve": False}).to_list(length=6)
    home_reserve = await riders_collection.find_one({"team_id": home_team_id, "is_reserve": True})
    away_riders = await riders_collection.find({"team_id": away_team_id, "is_reserve": False}).to_list(length=6)
    away_reserve = await riders_collection.find_one({"team_id": away_team_id, "is_reserve": True})

    if len(home_riders) < 6 or len(away_riders) < 6:
        return await generate_default_heats(home_team_id, away_team_id)

    # Predefined gate assignments for 15 heats
    heat_program = [
        {"heat": 1, "gates": {"1": 0, "2": 0, "3": 1, "4": 1}},
        {"heat": 2, "gates": {"1": 1, "2": 2, "3": 0, "4": 2}},
        {"heat": 3, "gates": {"1": 2, "2": 1, "3": 3, "4": 0}},
        {"heat": 4, "gates": {"1": 3, "2": 3, "3": 2, "4": 4}},
        {"heat": 5, "gates": {"1": 4, "2": 0, "3": 5, "4": 3}},
        {"heat": 6, "gates": {"1": 5, "2": 5, "3": 4, "4": 1}},
        {"heat": 7, "gates": {"1": 0, "2": 4, "3": 1, "4": 5}},
        {"heat": 8, "gates": {"1": 1, "2": 3, "3": 2, "4": 0}},
        {"heat": 9, "gates": {"1": 2, "2": 2, "3": 3, "4": 3}},
        {"heat": 10, "gates": {"1": 3, "2": 1, "3": 4, "4": 2}},
        {"heat": 11, "gates": {"1": 4, "2": 5, "3": 5, "4": 4}},
        {"heat": 12, "gates": {"1": 5, "2": 0, "3": 0, "4": 1}},
        {"heat": 13, "gates": {"1": 0, "2": 2, "3": 1, "4": 3}},
        {"heat": 14, "gates": {"1": 1, "2": 4, "3": 2, "4": 5}},
        {"heat": 15, "gates": {"1": 2, "2": 1, "3": 3, "4": 0}},
    ]

    home_colors = get_team_colors("home")
    away_colors = get_team_colors("away")

    heats: List[Dict[str, Any]] = []
    for heat_info in heat_program:
        heat: Dict[str, Any] = {
            "heat_number": heat_info["heat"],
            "riders": {},
            "results": [],
            "status": "upcoming",
            "joker_rider": None,
            "is_tactical_heat": heat_info["heat"] == 15,
        }
        for gate, rider_index in heat_info["gates"].items():
            gate_int = int(gate)
            if gate_int in (1, 3):  # Home team gates
                if rider_index < len(home_riders):
                    color_index = 0 if gate_int == 1 else 1
                    rider = home_riders[rider_index]
                    heat["riders"][gate] = {
                        "rider_id": rider["id"],
                        "name": rider["name"],
                        "team": "home",
                        "helmet_color": home_colors[color_index],
                    }
            else:  # Away team gates (2, 4)
                if rider_index < len(away_riders):
                    color_index = 0 if gate_int == 2 else 1
                    rider = away_riders[rider_index]
                    heat["riders"][gate] = {
                        "rider_id": rider["id"],
                        "name": rider["name"],
                        "team": "away",
                        "helmet_color": away_colors[color_index],
                    }
        heats.append(heat)
    return heats


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


###########################
# Startup event: seed sample data
###########################

# @app.on_event("startup")
# async def startup_event() -> None:
#     """
#     Populate the database with sample teams and riders if none exist.
#     This event runs when the FastAPI application starts.
#     """
#     if await teams_collection.count_documents({}) == 0:
#         # Create sample teams
#         sample_teams = [
#             {"id": str(uuid.uuid4()), "name": "Dackarna", "city": "Malilla", "points": 0, "matches_played": 0},
#             {"id": str(uuid.uuid4()), "name": "Masarna", "city": "Avesta", "points": 0, "matches_played": 0},
#             {"id": str(uuid.uuid4()), "name": "Vetlanda", "city": "Vetlanda", "points": 0, "matches_played": 0},
#             {"id": str(uuid.uuid4()), "name": "Indianerna", "city": "Kumla", "points": 0, "matches_played": 0},
#             {"id": str(uuid.uuid4()), "name": "Vargarna", "city": "Norrköping", "points": 0, "matches_played": 0},
#             {"id": str(uuid.uuid4()), "name": "Rospiggarna", "city": "Hallstavik", "points": 0, "matches_played": 0},
#             {"id": str(uuid.uuid4()), "name": "Smederna", "city": "Eskilstuna", "points": 0, "matches_played": 0},
#         ]
#         await teams_collection.insert_many(sample_teams)
#         # Create sample riders for each team (6 main + 1 reserve)
#         teams = await teams_collection.find().to_list(length=None)
#         for idx, team in enumerate(teams):
#             team_colors = get_team_colors("home" if idx % 2 == 0 else "away")
#             for i in range(7):
#                 rider = {
#                     "id": str(uuid.uuid4()),
#                     "name": f"{team['name']} Förare {i+1}",
#                     "team_id": team["id"],
#                     "helmet_color": team_colors[i % 2],
#                     "number": i + 1,
#                     "is_reserve": i == 6,
#                 }
#                 await riders_collection.insert_one(rider)


###########################
# Authentication endpoints
###########################

@app.post("/api/auth/register")
async def register(user_data: UserRegister) -> Dict[str, Any]:
    """
    Register a new user. Returns a JWT and user data on success.
    Raises HTTP 400 if the username or email already exists.
    """
    existing = await users_collection.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
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
    await users_collection.insert_one(user_doc)
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


@app.get("/api/teams/{team_id}/riders")
async def get_team_riders(team_id: str) -> List[Dict[str, Any]]:
    """Return all riders belonging to a team."""
    riders_cursor = riders_collection.find({"team_id": team_id}, {"_id": 0})
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


@app.post("/api/matches")
async def create_match(match_data: Dict[str, Any], user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """
    Create a new match with 15 predetermined heats. A user cannot create
    duplicate matches for the same teams and date.
    """
    # Normalize the date and check for duplicates
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
    heats = await generate_match_heats(match_data["home_team_id"], match_data["away_team_id"])
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
    }
    await matches_collection.insert_one(match_doc)
    return {"message": "Match skapad med förbestämda heat", "match_id": match_id}


@app.get("/api/matches/{match_id}")
async def get_match(match_id: str) -> Dict[str, Any]:
    """Return a specific match by id, enriched with team names."""
    match = await matches_collection.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    home_team = await teams_collection.find_one({"id": match["home_team_id"]})
    away_team = await teams_collection.find_one({"id": match["away_team_id"]})
    match["home_team"] = home_team["name"] if home_team else "Okänt lag"
    match["away_team"] = away_team["name"] if away_team else "Okänt lag"
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


@app.put("/api/matches/{match_id}/heat/{heat_number}/riders")
async def update_heat_riders(
    match_id: str,
    heat_number: int,
    rider_assignments: Dict[str, str],
    user_id: str = Depends(verify_jwt_token),
) -> Dict[str, Any]:
    """
    Update rider assignments for a specific heat within a match.

    The request body should be a mapping of gate numbers ("1"–"4") to
    rider IDs. Each rider ID must belong to the correct team based on
    the gate: gates 1 and 3 are home gates, gates 2 and 4 are away gates.
    To adhere to Elitserien rules, only heats 5–13 can be modified for
    tactical reserves or rider replacements. Attempts to modify other
    heats will result in a 400 error.

    Example body:
    {
        "1": "rider_id_for_home_gate1",
        "3": "rider_id_for_home_gate3",
        "2": "rider_id_for_away_gate2",
        "4": "rider_id_for_away_gate4"
    }
    """
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    # Locate heat index
    heat_idx = None
    for idx, heat in enumerate(match["heats"]):
        if heat.get("heat_number") == heat_number:
            heat_idx = idx
            break
    if heat_idx is None:
        raise HTTPException(status_code=404, detail="Heat hittades inte")
    # Disallow editing outside tactical reserve windows (heats 5–13)
    if heat_number < 5 or heat_number > 13:
        raise HTTPException(status_code=400, detail="Endast heat 5–13 kan ändras enligt reglerna")
    # Update riders for each gate
    current_heat = match["heats"][heat_idx]
    for gate, new_rider_id in rider_assignments.items():
        if gate not in {"1", "2", "3", "4"}:
            continue
        gate_int = int(gate)
        # Determine which team the gate belongs to
        expected_team = "home" if gate_int in (1, 3) else "away"
        # Fetch rider from DB
        rider = await riders_collection.find_one({"id": new_rider_id})
        if not rider:
            raise HTTPException(status_code=404, detail=f"Förare {new_rider_id} hittades inte")
        if rider.get("team_id") != match[f"{expected_team}_team_id"]:
            raise HTTPException(status_code=400, detail=f"Förare {rider['name']} tillhör inte {expected_team}-laget")
        # Assign new rider to gate
        colors = get_team_colors(expected_team)
        color_index = 0 if gate_int in (1, 2) else 1
        current_heat["riders"][gate] = {
            "rider_id": rider["id"],
            "name": rider["name"],
            "team": expected_team,
            "helmet_color": colors[color_index],
        }
    # Persist changes
    match["heats"][heat_idx] = current_heat
    await matches_collection.update_one({"id": match_id}, {"$set": {"heats": match["heats"]}})
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


@app.put("/api/matches/{match_id}/confirm")
async def confirm_match(match_id: str, user_id: str = Depends(verify_jwt_token)) -> Dict[str, Any]:
    """
    Confirm a completed match and store it in the user's matches. Compares
    results with official results if available and marks discrepancies.
    """
    match = await matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
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
        from scraping.flashscore import fetch_official_speedway_matches  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import error: {e}")
    try:
        matches = fetch_official_speedway_matches()  # synchronous function returns list
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

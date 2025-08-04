import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import jwt
import bcrypt

# Environment setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = os.environ.get('JWT_SECRET', 'speedway-secret-key-2025')
JWT_ALGORITHM = "HS256"

# MongoDB setup
client = MongoClient(MONGO_URL)
db = client['speedway_elitserien']
users_collection = db['users']
teams_collection = db['teams']
matches_collection = db['matches']
riders_collection = db['riders']

# FastAPI app
app = FastAPI(title="Speedway Elitserien API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Pydantic models
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Team(BaseModel):
    id: str
    name: str
    city: str
    points: int = 0
    matches_played: int = 0

class Rider(BaseModel):
    id: str
    name: str
    team_id: str
    helmet_color: str
    number: int
    is_reserve: bool = False

class Match(BaseModel):
    id: str
    home_team_id: str
    away_team_id: str
    date: datetime
    venue: str
    status: str = "upcoming"  # upcoming, live, completed
    home_score: int = 0
    away_score: int = 0
    heats: List[dict] = []
    joker_used_home: bool = False
    joker_used_away: bool = False

class HeatResult(BaseModel):
    heat_number: int
    results: List[dict]  # [{"rider_id": "xxx", "position": 1, "points": 3, "status": "completed"}]
    joker_rider_id: Optional[str] = None

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_match_heats(home_team_id: str, away_team_id: str):
    """Generate the 15 predetermined heats for a speedway match"""
    # Get riders for both teams (6 main riders + 1 reserve each)
    home_riders = list(riders_collection.find({"team_id": home_team_id, "is_reserve": False}).limit(6))
    home_reserve = riders_collection.find_one({"team_id": home_team_id, "is_reserve": True})
    away_riders = list(riders_collection.find({"team_id": away_team_id, "is_reserve": False}).limit(6))
    away_reserve = riders_collection.find_one({"team_id": away_team_id, "is_reserve": True})

    if len(home_riders) < 6 or len(away_riders) < 6:
        # If teams don't have enough riders, create default ones
        return generate_default_heats(home_team_id, away_team_id)

    # Standard 15-heat program with predetermined gate positions
    heat_program = [
        # Heat 1-15 with rider positions (home riders: 1,3,5,7,9,11 | away riders: 2,4,6,8,10,12)
        {"heat": 1, "gates": {"1": 0, "2": 0, "3": 1, "4": 1}},  # Home: rider 1,3 | Away: rider 1,2
        {"heat": 2, "gates": {"1": 1, "2": 2, "3": 0, "4": 2}},  # Home: rider 2,4 | Away: rider 2,3  
        {"heat": 3, "gates": {"1": 2, "2": 1, "3": 3, "4": 0}},  # Home: rider 3,1 | Away: rider 2,4
        {"heat": 4, "gates": {"1": 3, "2": 3, "3": 2, "4": 4}},  # Home: rider 4,3 | Away: rider 4,5
        {"heat": 5, "gates": {"1": 4, "2": 0, "3": 5, "4": 3}},  # Home: rider 5,6 | Away: rider 1,4
        {"heat": 6, "gates": {"1": 5, "2": 5, "3": 4, "4": 1}},  # Home: rider 6,5 | Away: rider 6,2
        {"heat": 7, "gates": {"1": 0, "2": 4, "3": 1, "4": 5}},  # Home: rider 1,2 | Away: rider 5,6
        {"heat": 8, "gates": {"1": 1, "2": 3, "3": 2, "4": 0}},  # Home: rider 2,3 | Away: rider 4,1
        {"heat": 9, "gates": {"1": 2, "2": 2, "3": 3, "4": 3}},  # Home: rider 3,4 | Away: rider 3,4
        {"heat": 10, "gates": {"1": 3, "2": 1, "3": 4, "4": 2}}, # Home: rider 4,5 | Away: rider 2,3
        {"heat": 11, "gates": {"1": 4, "2": 5, "3": 5, "4": 4}}, # Home: rider 5,6 | Away: rider 6,5
        {"heat": 12, "gates": {"1": 5, "2": 0, "3": 0, "4": 1}}, # Home: rider 6,1 | Away: rider 1,2
        {"heat": 13, "gates": {"1": 0, "2": 2, "3": 1, "4": 3}}, # Home: rider 1,2 | Away: rider 3,4
        {"heat": 14, "gates": {"1": 1, "2": 4, "3": 2, "4": 5}}, # Home: rider 2,3 | Away: rider 5,6
        {"heat": 15, "gates": {"1": 2, "2": 1, "3": 3, "4": 0}}, # Heat 15 - Nominerade förare
    ]

    heats = []
    for heat_info in heat_program:
        heat = {
            "heat_number": heat_info["heat"],
            "riders": {},
            "results": [],
            "status": "upcoming",
            "joker_rider": None,
            "is_tactical_heat": heat_info["heat"] == 15  # Last heat can be tactical
        }
        
        # Assign riders to gates
        for gate, rider_index in heat_info["gates"].items():
            if int(gate) in [1, 3]:  # Home team gates
                if rider_index < len(home_riders):
                    heat["riders"][gate] = {
                        "rider_id": home_riders[rider_index]["id"],
                        "name": home_riders[rider_index]["name"],
                        "team": "home",
                        "helmet_color": home_riders[rider_index].get("helmet_color", "#FF0000")
                    }
            else:  # Away team gates (2, 4)
                if rider_index < len(away_riders):
                    heat["riders"][gate] = {
                        "rider_id": away_riders[rider_index]["id"],
                        "name": away_riders[rider_index]["name"],
                        "team": "away", 
                        "helmet_color": away_riders[rider_index].get("helmet_color", "#0000FF")
                    }
        
        heats.append(heat)
    
    return heats

def generate_default_heats(home_team_id: str, away_team_id: str):
    """Generate default heats when teams don't have enough riders"""
    home_team = teams_collection.find_one({"id": home_team_id})
    away_team = teams_collection.find_one({"id": away_team_id})
    
    heats = []
    for i in range(1, 16):
        heat = {
            "heat_number": i,
            "riders": {
                "1": {"rider_id": f"home_{i}_1", "name": f"{home_team['name']} Förare {i}A", "team": "home", "helmet_color": "#FF0000"},
                "2": {"rider_id": f"away_{i}_1", "name": f"{away_team['name']} Förare {i}A", "team": "away", "helmet_color": "#0000FF"},
                "3": {"rider_id": f"home_{i}_2", "name": f"{home_team['name']} Förare {i}B", "team": "home", "helmet_color": "#FF0000"},
                "4": {"rider_id": f"away_{i}_2", "name": f"{away_team['name']} Förare {i}B", "team": "away", "helmet_color": "#0000FF"}
            },
            "results": [],
            "status": "upcoming",
            "joker_rider": None,
            "is_tactical_heat": i == 15
        }
        heats.append(heat)
    
    return heats

# Initialize sample data
@app.on_event("startup")
async def startup_event():
    # Check if teams exist, if not create sample teams
    if teams_collection.count_documents({}) == 0:
        sample_teams = [
            {"id": str(uuid.uuid4()), "name": "Dackarna", "city": "Malilla", "points": 0, "matches_played": 0},
            {"id": str(uuid.uuid4()), "name": "Masarna", "city": "Avesta", "points": 0, "matches_played": 0},
            {"id": str(uuid.uuid4()), "name": "Vetlanda", "city": "Vetlanda", "points": 0, "matches_played": 0},
            {"id": str(uuid.uuid4()), "name": "Indianerna", "city": "Kumla", "points": 0, "matches_played": 0},
            {"id": str(uuid.uuid4()), "name": "Vargarna", "city": "Norrköping", "points": 0, "matches_played": 0},
            {"id": str(uuid.uuid4()), "name": "Rospiggarna", "city": "Hallstavik", "points": 0, "matches_played": 0},
            {"id": str(uuid.uuid4()), "name": "Smederna", "city": "Eskilstuna", "points": 0, "matches_played": 0},
        ]
        teams_collection.insert_many(sample_teams)
        
        # Create sample riders for each team
        teams = list(teams_collection.find())
        for team in teams:
            # Create 6 main riders + 1 reserve per team
            for i in range(7):
                rider = {
                    "id": str(uuid.uuid4()),
                    "name": f"{team['name']} Förare {i+1}",
                    "team_id": team["id"],
                    "helmet_color": f"#{['FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', 'FFA500'][i]}",
                    "number": i + 1,
                    "is_reserve": i == 6  # Last rider is reserve
                }
                riders_collection.insert_one(rider)

# API Endpoints

# Authentication
@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    if users_collection.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]}):
        raise HTTPException(status_code=400, detail="Användare finns redan")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    
    user = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(user)
    token = create_jwt_token(user_id)
    
    return {"token": token, "user": {"id": user_id, "username": user_data.username, "email": user_data.email}}

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = users_collection.find_one({"username": user_data.username})
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Felaktiga inloggningsuppgifter")
    
    token = create_jwt_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "email": user["email"]}}

# Teams
@app.get("/api/teams")
async def get_teams():
    teams = list(teams_collection.find({}, {"_id": 0}))
    # Sort by points descending
    teams.sort(key=lambda x: x["points"], reverse=True)
    return teams

@app.get("/api/teams/{team_id}")
async def get_team(team_id: str):
    team = teams_collection.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Lag hittades inte")
    return team

@app.get("/api/teams/{team_id}/riders")
async def get_team_riders(team_id: str):
    riders = list(riders_collection.find({"team_id": team_id}, {"_id": 0}))
    return riders

# Matches
@app.get("/api/matches")
async def get_matches():
    matches = list(matches_collection.find({}, {"_id": 0}))
    # Get team names for each match
    for match in matches:
        home_team = teams_collection.find_one({"id": match["home_team_id"]})
        away_team = teams_collection.find_one({"id": match["away_team_id"]})
        match["home_team"] = home_team["name"] if home_team else "Okänt lag"
        match["away_team"] = away_team["name"] if away_team else "Okänt lag"
    return matches

@app.post("/api/matches")
async def create_match(match_data: dict, user_id: str = Depends(verify_jwt_token)):
    match_id = str(uuid.uuid4())
    
    # Generate the 15 predetermined heats
    heats = generate_match_heats(match_data["home_team_id"], match_data["away_team_id"])
    
    match = {
        "id": match_id,
        "home_team_id": match_data["home_team_id"],
        "away_team_id": match_data["away_team_id"],
        "date": datetime.fromisoformat(match_data["date"].replace("Z", "+00:00")),
        "venue": match_data["venue"],
        "status": "upcoming",
        "home_score": 0,
        "away_score": 0,
        "heats": heats,
        "joker_used_home": False,
        "joker_used_away": False,
        "created_by": user_id,
        "created_at": datetime.utcnow()
    }
    matches_collection.insert_one(match)
    return {"message": "Match skapad med förbestämda heat", "match_id": match_id}

@app.get("/api/matches/{match_id}")
async def get_match(match_id: str):
    match = matches_collection.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    
    # Get team information
    home_team = teams_collection.find_one({"id": match["home_team_id"]})
    away_team = teams_collection.find_one({"id": match["away_team_id"]})
    match["home_team"] = home_team["name"] if home_team else "Okänt lag"
    match["away_team"] = away_team["name"] if away_team else "Okänt lag"
    
    return match

@app.put("/api/matches/{match_id}/heat/{heat_number}/result")
async def update_heat_result(match_id: str, heat_number: int, result_data: dict, user_id: str = Depends(verify_jwt_token)):
    match = matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    
    # Find the heat to update
    heat_index = None
    for i, heat in enumerate(match["heats"]):
        if heat["heat_number"] == heat_number:
            heat_index = i
            break
    
    if heat_index is None:
        raise HTTPException(status_code=404, detail="Heat hittades inte")
    
    # Update heat results
    points_map = {1: 3, 2: 2, 3: 1, 4: 0}
    updated_results = []
    home_points = 0
    away_points = 0
    joker_applied = False
    
    for result in result_data["results"]:
        points = 0
        if result["status"] == "completed":
            points = points_map.get(result["position"], 0)
        elif result["status"] == "excluded":
            points = 0
        
        # Apply joker if specified
        if result_data.get("joker_rider_id") == result["rider_id"]:
            points *= 2
            joker_applied = True
        
        updated_results.append({
            "rider_id": result["rider_id"],
            "position": result.get("position", 0),
            "points": points,
            "status": result["status"]
        })
        
        # Add to team totals
        rider = None
        for gate, rider_info in match["heats"][heat_index]["riders"].items():
            if rider_info["rider_id"] == result["rider_id"]:
                rider = rider_info
                break
        
        if rider:
            if rider["team"] == "home":
                home_points += points
            else:
                away_points += points
    
    # Update the match document
    match["heats"][heat_index]["results"] = updated_results
    match["heats"][heat_index]["status"] = "completed"
    match["heats"][heat_index]["joker_rider"] = result_data.get("joker_rider_id")
    match["home_score"] += home_points
    match["away_score"] += away_points
    
    # Mark joker as used if applied
    if joker_applied:
        if result_data.get("joker_team") == "home":
            match["joker_used_home"] = True
        else:
            match["joker_used_away"] = True
    
    matches_collection.update_one(
        {"id": match_id},
        {"$set": {
            "heats": match["heats"],
            "home_score": match["home_score"],
            "away_score": match["away_score"],
            "joker_used_home": match["joker_used_home"],
            "joker_used_away": match["joker_used_away"]
        }}
    )
    
    return {"message": "Heat resultat uppdaterat", "home_points": home_points, "away_points": away_points}

@app.put("/api/matches/{match_id}/substitute")
async def tactical_substitute(match_id: str, substitute_data: dict, user_id: str = Depends(verify_jwt_token)):
    """Make a tactical substitution - replace a rider with another from the same team"""
    match = matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    
    heat_number = substitute_data["heat_number"]
    old_rider_id = substitute_data["old_rider_id"]
    new_rider_id = substitute_data["new_rider_id"]
    
    # Find and update the heat
    for heat in match["heats"]:
        if heat["heat_number"] == heat_number:
            for gate, rider in heat["riders"].items():
                if rider["rider_id"] == old_rider_id:
                    # Get new rider info
                    new_rider = riders_collection.find_one({"id": new_rider_id})
                    if new_rider:
                        heat["riders"][gate] = {
                            "rider_id": new_rider["id"],
                            "name": new_rider["name"],
                            "team": rider["team"],
                            "helmet_color": new_rider["helmet_color"]
                        }
                    break
            break
    
    matches_collection.update_one(
        {"id": match_id},
        {"$set": {"heats": match["heats"]}}
    )
    
    return {"message": "Tactical substitution genomförd"}

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Speedway Elitserien API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
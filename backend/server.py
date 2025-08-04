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
heats_collection = db['heats']

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

class Driver(BaseModel):
    id: str
    name: str
    team_id: str
    helmet_color: str

class Match(BaseModel):
    id: str
    home_team_id: str
    away_team_id: str
    date: datetime
    venue: str
    status: str = "upcoming"  # upcoming, live, completed
    home_score: int = 0
    away_score: int = 0

class Heat(BaseModel):
    id: str
    match_id: str
    heat_number: int
    drivers: List[dict]  # [{"driver_id": "xxx", "gate": 1, "points": 3, "position": 1}]
    status: str = "upcoming"  # upcoming, completed

class HeatResult(BaseModel):
    heat_id: str
    results: List[dict]  # [{"driver_id": "xxx", "position": 1, "points": 3}]

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
    match = {
        "id": match_id,
        "home_team_id": match_data["home_team_id"],
        "away_team_id": match_data["away_team_id"],
        "date": datetime.fromisoformat(match_data["date"].replace("Z", "+00:00")),
        "venue": match_data["venue"],
        "status": "upcoming",
        "home_score": 0,
        "away_score": 0,
        "created_by": user_id,
        "created_at": datetime.utcnow()
    }
    matches_collection.insert_one(match)
    return {"message": "Match skapad", "match_id": match_id}

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
    
    # Get heats for this match
    heats = list(heats_collection.find({"match_id": match_id}, {"_id": 0}))
    match["heats"] = heats
    
    return match

# Heats
@app.post("/api/matches/{match_id}/heats")
async def create_heat(match_id: str, heat_data: dict, user_id: str = Depends(verify_jwt_token)):
    heat_id = str(uuid.uuid4())
    heat = {
        "id": heat_id,
        "match_id": match_id,
        "heat_number": heat_data["heat_number"],
        "drivers": heat_data["drivers"],  # [{"name": "Driver Name", "team": "Team", "gate": 1}]
        "status": "upcoming",
        "created_at": datetime.utcnow()
    }
    heats_collection.insert_one(heat)
    return {"message": "Heat skapat", "heat_id": heat_id}

@app.put("/api/heats/{heat_id}/result")
async def update_heat_result(heat_id: str, result_data: HeatResult, user_id: str = Depends(verify_jwt_token)):
    heat = heats_collection.find_one({"id": heat_id})
    if not heat:
        raise HTTPException(status_code=404, detail="Heat hittades inte")
    
    # Update heat with results
    points_map = {1: 3, 2: 2, 3: 1, 4: 0}  # Position to points mapping
    
    for result in result_data.results:
        result["points"] = points_map.get(result["position"], 0)
    
    heats_collection.update_one(
        {"id": heat_id},
        {"$set": {"results": result_data.results, "status": "completed", "completed_at": datetime.utcnow()}}
    )
    
    return {"message": "Heat resultat uppdaterat"}

@app.get("/api/heats/{heat_id}")
async def get_heat(heat_id: str):
    heat = heats_collection.find_one({"id": heat_id}, {"_id": 0})
    if not heat:
        raise HTTPException(status_code=404, detail="Heat hittades inte")
    return heat

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Speedway Elitserien API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
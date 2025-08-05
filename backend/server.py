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
import requests
from bs4 import BeautifulSoup

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
user_matches_collection = db['user_matches']
official_results_collection = db['official_results']

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
    status: str = "upcoming"  # upcoming, live, completed, confirmed
    home_score: int = 0
    away_score: int = 0
    heats: List[dict] = []
    joker_used_home: bool = False
    joker_used_away: bool = False

class UserMatch(BaseModel):
    id: str
    user_id: str
    match_id: str
    user_results: dict
    official_results: Optional[dict] = None
    discrepancies: Optional[List[dict]] = []
    status: str = "completed"  # completed, validated, disputed
    completed_at: datetime

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

def get_team_colors(team_position):
    """Get standardized team colors - Home: red/blue, Away: yellow/white"""
    if team_position == "home":
        return ["#DC2626", "#1D4ED8"]  # Red, Blue
    else:  # away
        return ["#EAB308", "#FFFFFF"]  # Yellow, White

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

    heats = []
    for heat_info in heat_program:
        heat = {
            "heat_number": heat_info["heat"],
            "riders": {},
            "results": [],
            "status": "upcoming",
            "joker_rider": None,
            "is_tactical_heat": heat_info["heat"] == 15
        }
        
        # Assign riders to gates with standard team colors
        for gate, rider_index in heat_info["gates"].items():
            if int(gate) in [1, 3]:  # Home team gates
                if rider_index < len(home_riders):
                    color_index = 0 if int(gate) == 1 else 1
                    heat["riders"][gate] = {
                        "rider_id": home_riders[rider_index]["id"],
                        "name": home_riders[rider_index]["name"],
                        "team": "home",
                        "helmet_color": home_colors[color_index]
                    }
            else:  # Away team gates (2, 4)
                if rider_index < len(away_riders):
                    color_index = 0 if int(gate) == 2 else 1
                    heat["riders"][gate] = {
                        "rider_id": away_riders[rider_index]["id"],
                        "name": away_riders[rider_index]["name"],
                        "team": "away", 
                        "helmet_color": away_colors[color_index]
                    }
        
        heats.append(heat)
    
    return heats

def generate_default_heats(home_team_id: str, away_team_id: str):
    """Generate default heats when teams don't have enough riders"""
    home_team = teams_collection.find_one({"id": home_team_id})
    away_team = teams_collection.find_one({"id": away_team_id})
    
    home_colors = get_team_colors("home")
    away_colors = get_team_colors("away")
    
    heats = []
    for i in range(1, 16):
        heat = {
            "heat_number": i,
            "riders": {
                "1": {"rider_id": f"home_{i}_1", "name": f"{home_team['name']} Förare {i}A", "team": "home", "helmet_color": home_colors[0]},
                "2": {"rider_id": f"away_{i}_1", "name": f"{away_team['name']} Förare {i}A", "team": "away", "helmet_color": away_colors[0]},
                "3": {"rider_id": f"home_{i}_2", "name": f"{home_team['name']} Förare {i}B", "team": "home", "helmet_color": home_colors[1]},
                "4": {"rider_id": f"away_{i}_2", "name": f"{away_team['name']} Förare {i}B", "team": "away", "helmet_color": away_colors[1]}
            },
            "results": [],
            "status": "upcoming",
            "joker_rider": None,
            "is_tactical_heat": i == 15
        }
        heats.append(heat)
    
    return heats

async def scrape_official_results(home_team: str, away_team: str, date: str):
    """Scrape official results from Flashscore for comparison"""
    try:
        # This is a simplified version - in reality you'd need more sophisticated scraping
        # For now, return mock data to demonstrate the concept
        return {
            "home_score": 45,
            "away_score": 45,
            "source": "flashscore",
            "scraped_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return None

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
            team_colors = get_team_colors("home" if teams.index(team) % 2 == 0 else "away")
            for i in range(7):
                rider = {
                    "id": str(uuid.uuid4()),
                    "name": f"{team['name']} Förare {i+1}",
                    "team_id": team["id"],
                    "helmet_color": team_colors[i % 2],
                    "number": i + 1,
                    "is_reserve": i == 6  # Last rider is reserve
                }
                riders_collection.insert_one(rider)

# API Endpoints

# Authentication
@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    if users_collection.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]}):
        raise HTTPException(status_code=400, detail="Användare finns redan")
    
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

@app.put("/api/matches/{match_id}/confirm")
async def confirm_match(match_id: str, user_id: str = Depends(verify_jwt_token)):
    """Confirm a completed match and save it to user's matches"""
    match = matches_collection.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match hittades inte")
    
    # Check if all heats are completed
    completed_heats = sum(1 for heat in match["heats"] if heat["status"] == "completed")
    if completed_heats < 15:
        raise HTTPException(status_code=400, detail=f"Endast {completed_heats}/15 heat är avslutade")
    
    # Mark match as confirmed
    matches_collection.update_one(
        {"id": match_id},
        {"$set": {"status": "confirmed"}}
    )
    
    # Save to user's matches
    user_match_id = str(uuid.uuid4())
    user_match = {
        "id": user_match_id,
        "user_id": user_id,
        "match_id": match_id,
        "user_results": {
            "home_score": match["home_score"],
            "away_score": match["away_score"],
            "heats": match["heats"]
        },
        "status": "completed",
        "completed_at": datetime.utcnow()
    }
    
    # Try to get official results for comparison
    home_team = teams_collection.find_one({"id": match["home_team_id"]})
    away_team = teams_collection.find_one({"id": match["away_team_id"]})
    
    if home_team and away_team:
        official_results = await scrape_official_results(
            home_team["name"], 
            away_team["name"], 
            match["date"].strftime("%Y-%m-%d")
        )
        
        if official_results:
            user_match["official_results"] = official_results
            
            # Check for discrepancies
            discrepancies = []
            if abs(match["home_score"] - official_results["home_score"]) > 0:
                discrepancies.append({
                    "type": "home_score",
                    "user_value": match["home_score"],
                    "official_value": official_results["home_score"]
                })
            
            if abs(match["away_score"] - official_results["away_score"]) > 0:
                discrepancies.append({
                    "type": "away_score", 
                    "user_value": match["away_score"],
                    "official_value": official_results["away_score"]
                })
            
            if discrepancies:
                user_match["discrepancies"] = discrepancies
                user_match["status"] = "disputed"
    
    user_matches_collection.insert_one(user_match)
    
    return {
        "message": "Match bekräftad och sparad",
        "user_match_id": user_match_id,
        "discrepancies": user_match.get("discrepancies", [])
    }

@app.get("/api/user/matches")
async def get_user_matches(user_id: str = Depends(verify_jwt_token)):
    """Get all matches completed by the user"""
    user_matches = list(user_matches_collection.find({"user_id": user_id}, {"_id": 0}))
    
    # Enrich with match details
    for user_match in user_matches:
        match = matches_collection.find_one({"id": user_match["match_id"]})
        if match:
            home_team = teams_collection.find_one({"id": match["home_team_id"]})
            away_team = teams_collection.find_one({"id": match["away_team_id"]})
            user_match["match_details"] = {
                "home_team": home_team["name"] if home_team else "Okänt lag",
                "away_team": away_team["name"] if away_team else "Okänt lag",
                "date": match["date"],
                "venue": match["venue"]
            }
    
    return user_matches

@app.put("/api/user/matches/{user_match_id}/resolve")
async def resolve_discrepancy(user_match_id: str, resolution_data: dict, user_id: str = Depends(verify_jwt_token)):
    """Resolve discrepancies in a user match"""
    user_match = user_matches_collection.find_one({"id": user_match_id, "user_id": user_id})
    if not user_match:
        raise HTTPException(status_code=404, detail="Användarens match hittades inte")
    
    if resolution_data["action"] == "accept_official":
        # Update user results to match official
        if user_match.get("official_results"):
            user_match["user_results"]["home_score"] = user_match["official_results"]["home_score"]
            user_match["user_results"]["away_score"] = user_match["official_results"]["away_score"]
            user_match["status"] = "validated"
            user_match["discrepancies"] = []
    elif resolution_data["action"] == "keep_user":
        # Keep user results, mark as validated
        user_match["status"] = "validated"
        user_match["discrepancies"] = []
    
    user_matches_collection.update_one(
        {"id": user_match_id},
        {"$set": {
            "user_results": user_match["user_results"],
            "status": user_match["status"],
            "discrepancies": user_match["discrepancies"],
            "resolved_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Konflikt löst"}

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Speedway Elitserien API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
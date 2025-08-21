import os

ENV = os.getenv("ENV", "development")

if ENV == "production":
    FRONTEND_ORIGINS = ["https://speedway-frontend-production.up.railway.app"]
    MONGO_URL = os.getenv("MONGO_URL")  # Railway sätter detta i sina env vars
else:
    FRONTEND_ORIGINS = ["http://localhost:3000"]
    MONGO_URL = "mongodb://localhost:27017"

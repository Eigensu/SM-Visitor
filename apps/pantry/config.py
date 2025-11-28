"""
Configuration settings for the Pantry API
"""
import os
from dotenv import load_dotenv

"""
Configuration settings for the Pantry API
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")

# JWT
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-change-in-production-12345")
JWT_EXPIRY_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "7"))

# OTP
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "5"))

# Storage
STORAGE_TYPE = os.getenv("STORAGE_TYPE", "local")  # local or s3
LOCAL_STORAGE_PATH = os.getenv("LOCAL_STORAGE_PATH", "./storage")

# S3 Configuration (if using S3)
S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")

# CORS
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
).split(",")

# App URLs
ORBIT_URL = os.getenv("ORBIT_URL", "http://localhost:3000")
HORIZON_URL = os.getenv("HORIZON_URL", "http://localhost:3001")
PANTRY_URL = os.getenv("PANTRY_URL", "http://localhost:8000")

# Create storage directory if it doesn't exist
os.makedirs(LOCAL_STORAGE_PATH, exist_ok=True)
os.makedirs(os.path.join(LOCAL_STORAGE_PATH, "buffer"), exist_ok=True)

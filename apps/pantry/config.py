"""
Configuration settings for the Pantry API
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Basic environment mode: development | production
APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()

# Database
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")

# JWT - centralized and validated
# Do NOT set insecure defaults for production. In production the environment
# must provide a JWT_SECRET; in development we allow a clear local default.
_jwt_secret = os.getenv("JWT_SECRET")
if not _jwt_secret:
    if APP_ENV in ("production", "prod"):
        raise RuntimeError("JWT_SECRET environment variable must be set in production")
    # Development fallback (explicit): keep obvious value to encourage change
    _jwt_secret = "dev-local-secret-change-me"

JWT_SECRET = _jwt_secret
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "7"))

# OTP
OTP_LENGTH = int(os.getenv("OTP_LENGTH", "6"))
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "5"))

# Storage
STORAGE_TYPE = os.getenv("STORAGE_TYPE", "local")  # local or s3
LOCAL_STORAGE_PATH = os.getenv("LOCAL_STORAGE_PATH", "./storage")

# S3 Configuration (if using S3)
S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "sm-visitor/photos")

# CORS
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
    ).split(",") if o.strip()
]

# App URLs
ORBIT_URL = os.getenv("ORBIT_URL", "http://localhost:3000")
HORIZON_URL = os.getenv("HORIZON_URL", "http://localhost:3001")
PANTRY_URL = os.getenv("PANTRY_URL", "http://localhost:8000")

# Photo signing secret used to generate short-lived signed URLs for browser
# image loading when Authorization headers are not available.
# Prefer explicit PHOTO_SIGNING_SECRET in production. Fall back to
# `JWT_SECRET` only in non-production to preserve backward compatibility.
_photo_signing_secret = os.getenv("PHOTO_SIGNING_SECRET")
if not _photo_signing_secret:
    if APP_ENV in ("production", "prod"):
        raise RuntimeError("PHOTO_SIGNING_SECRET environment variable must be set in production")
    _photo_signing_secret = JWT_SECRET

PHOTO_SIGNING_SECRET = _photo_signing_secret

# Create storage directory if it doesn't exist
os.makedirs(LOCAL_STORAGE_PATH, exist_ok=True)
os.makedirs(os.path.join(LOCAL_STORAGE_PATH, "buffer"), exist_ok=True)

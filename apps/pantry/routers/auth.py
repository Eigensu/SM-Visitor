"""
Unified Authentication System
Handles signup, login, and JWT token management for all user types
Supports: Owners (Residents), Guards, Admins
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import bcrypt
import os

# Fix for passlib/bcrypt incompatibility (AttributeError: module 'bcrypt' has no attribute '__about__')
if not hasattr(bcrypt, "__about__"):
    class BcryptAbout:
        __version__ = bcrypt.__version__
    bcrypt.__about__ = BcryptAbout()

from database import get_database
from bson import ObjectId
from utils.time_utils import get_ist_now, get_utc_now
from utils.sse_manager import sse_manager
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()
# JWT configuration (centralized in config.py)
JWT_EXPIRATION_HOURS = JWT_EXPIRY_DAYS * 24


# Request/Response Models
class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r"^\d{10}$")  # 10 digit phone
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern=r"^(owner|guard|admin)$")
    flat_id: Optional[str] = None  # Required for owners


class LoginRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    password: str = Field(..., min_length=1)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    name: str
    phone: str
    role: str
    flat_id: Optional[str]
    created_at: datetime


# Helper Functions
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    # bcrypt.hashpw returns bytes, decode to string for storage
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # bcrypt.checkpw requires bytes
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def create_access_token(user_id: str, role: str) -> str:
    """Create JWT access token"""
    now = get_utc_now()
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": now
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )



def get_collection_by_role(db, role: str):
    """Get the appropriate collection based on user role"""
    if role == "owner":
        return db.residents
    elif role == "guard":
        return db.guards
    else:  # admin
        return db.users


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_database)
):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception as e:
        logger.debug("Token decode failed: %s", e)
        raise e
    
    try:
        user_id = ObjectId(payload["user_id"])
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format"
        )
    
    # Try to find user in the appropriate collection based on role
    role = payload.get("role")
    collection = get_collection_by_role(db, role)
    user = await collection.find_one({"_id": user_id})
    
    if not user:
        logger.debug("User not found for ID from token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Update last seen
    await collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_seen": get_utc_now()}}
    )
    
    return user


async def _notify_new_user(
    user_id: str,
    name: str,
    role: str,
    flat_id: Optional[str],
    registered_at: str,
):
    """Broadcast new_user_registered to all connected staff. Runs as a background task."""
    payload = {
        "user_id": user_id,
        "name": name,
        "role": role,
        "flat_id": flat_id,
        "registered_at": registered_at,
    }
    for target_role in ("admin", "owner", "guard"):
        try:
            await sse_manager.broadcast_to_role(target_role, "new_user_registered", payload)
        except Exception as e:
            logger.warning("[SSE] broadcast to %s failed: %s", target_role, e)


# Endpoints
@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, background_tasks: BackgroundTasks, db = Depends(get_database)):
    """
    Register a new user (Owner, Guard, or Admin)
    
    - **name**: Full name of the user
    - **phone**: 10-digit phone number (unique identifier)
    - **password**: Minimum 6 characters
    - **role**: owner, guard, or admin
    - **flat_id**: Required for owners (e.g., "A-401")
    """
    # Validate flat_id for owners
    if request.role == "owner" and not request.flat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="flat_id is required for owners"
        )
    
    # Get the appropriate collection based on role
    collection = get_collection_by_role(db, request.role)
    
    # Check if phone already exists in the appropriate collection
    existing_user = await collection.find_one({"phone": request.phone})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered"
        )
    
    # Create user document
    user_doc = {
        "name": request.name,
        "phone": request.phone,
        "password_hash": hash_password(request.password),
        "role": request.role,
        "flat_id": request.flat_id,
        "last_seen": None,
        "created_at": get_utc_now(),
        "metadata": {}
    }
    
    # Insert into the appropriate collection
    result = await collection.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Generate JWT token
    access_token = create_access_token(user_id, request.role)
    
    # Prepare response
    user_response = {
        "id": user_id,
        "name": request.name,
        "phone": request.phone,
        "role": request.role,
        "flat_id": request.flat_id,
        "created_at": user_doc["created_at"]
    }
    
    # Notify all connected users (admins, owners, guards) about the new registration.
    # Runs in the background – never blocks or fails the signup response.
    background_tasks.add_task(
        _notify_new_user,
        user_id,
        request.name,
        request.role,
        request.flat_id,
        user_doc["created_at"].isoformat(),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db = Depends(get_database)):
    """
    Login with phone and password
    
    - **phone**: 10-digit phone number
    - **password**: User's password
    
    Returns JWT token valid for 7 days
    """
    # Try to find user in all collections
    user = None
    collection = None
    
    # Try residents first (owners)
    user = await db.residents.find_one({"phone": request.phone})
    if user:
        collection = db.residents
    
    # Try guards if not found
    if not user:
        user = await db.guards.find_one({"phone": request.phone})
        if user:
            collection = db.guards
    
    # Try users (admins) if still not found
    if not user:
        user = await db.users.find_one({"phone": request.phone})
        if user:
            collection = db.users
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone or password"
        )
    
    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone or password"
        )
    
    # Generate JWT token
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user["role"])
    
    # Update last seen
    await collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_seen": get_utc_now()}}
    )
    
    # Prepare response
    user_response = {
        "id": user_id,
        "name": user["name"],
        "phone": user["phone"],
        "role": user["role"],
        "flat_id": user.get("flat_id"),
        "created_at": user["created_at"]
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    """
    Get current authenticated user profile
    
    Requires: Bearer token in Authorization header
    """
    return {
        "id": str(current_user["_id"]),
        "name": current_user["name"],
        "phone": current_user["phone"],
        "role": current_user["role"],
        "flat_id": current_user.get("flat_id"),
        "created_at": current_user["created_at"]
    }


@router.post("/logout")
async def logout(current_user = Depends(get_current_user)):
    """
    Logout current user
    
    Note: Since we use stateless JWT, actual logout happens on client side
    by removing the token. This endpoint is for logging purposes.
    """
    return {"message": "Logged out successfully"}


# Role-based access control helpers
def require_role(*allowed_roles: str):
    """Dependency to require specific roles"""
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


# Export for use in other routers
require_owner = require_role("owner", "admin")
require_guard = require_role("guard", "admin")
require_admin = require_role("admin")

"""
Authentication Routes - Username/Password based
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from database import db
from config import JWT_SECRET, JWT_EXPIRY_DAYS
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Request/Response Models
class SignupRequest(BaseModel):
    username: str
    password: str
    name: str
    role: str  # "guard" or "owner"
    flat_id: str | None = None  # Required for owners

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")

# Endpoints
@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    """Sign up a new user (guard or owner)"""
    users = db.users
    
    # Check if username already exists
    existing_user = await users.find_one({"username": request.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate role
    if request.role not in ["guard", "owner"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Validate flat_id for owners
    if request.role == "owner" and not request.flat_id:
        raise HTTPException(status_code=400, detail="flat_id required for owners")
    
    # Create user
    user_doc = {
        "username": request.username,
        "password": hash_password(request.password),
        "name": request.name,
        "role": request.role,
        "created_at": datetime.utcnow(),
    }
    
    if request.role == "owner":
        user_doc["flat_id"] = request.flat_id
    
    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Create token
    token = create_access_token({"user_id": user_id, "role": request.role})
    
    # Return response
    user_response = {
        "_id": user_id,
        "username": request.username,
        "name": request.name,
        "role": request.role,
    }
    
    if request.role == "owner":
        user_response["flat_id"] = request.flat_id
    
    return {"token": token, "user": user_response}

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login with username and password"""
    users = db.users
    
    # Find user
    user = await users.find_one({"username": request.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    user_id = str(user["_id"])
    token = create_access_token({"user_id": user_id, "role": user["role"]})
    
    # Return response
    user_response = {
        "_id": user_id,
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
    }
    
    if user.get("flat_id"):
        user_response["flat_id"] = user["flat_id"]
    
    return {"token": token, "user": user_response}

@router.get("/me")
async def get_current_user(authorization: str = Header(None)):
    """Get current authenticated user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Return user info
        user_response = {
            "_id": str(user["_id"]),
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
        }
        
        if user.get("flat_id"):
            user_response["flat_id"] = user["flat_id"]
        
        return user_response
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

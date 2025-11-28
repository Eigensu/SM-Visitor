"""
Authentication router - handles login, OTP verification, and user info
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_users_collection
from utils.otp_utils import generate_otp, get_otp_expiry, is_otp_valid, send_otp
from utils.jwt_utils import create_access_token
from middleware.auth import get_current_user
from typing import Dict, Any


router = APIRouter(prefix="/auth", tags=["Authentication"])


# Request/Response Models
class LoginRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, description="Phone number")


class LoginResponse(BaseModel):
    success: bool
    message: str


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)


class UserResponse(BaseModel):
    _id: str
    name: str
    phone: str
    role: str
    flat_id: str | None = None
    created_at: datetime


class VerifyOTPResponse(BaseModel):
    token: str
    user: UserResponse


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Send OTP to phone number
    Creates user if doesn't exist (defaults to owner role)
    """
    users = get_users_collection()
    
    # Find or create user
    user = await users.find_one({"phone": request.phone})
    
    if not user:
        # Create new user (default role: owner)
        new_user = {
            "name": f"User {request.phone[-4:]}",  # Temporary name
            "phone": request.phone,
            "role": "owner",
            "created_at": datetime.utcnow(),
        }
        result = await users.insert_one(new_user)
        user = await users.find_one({"_id": result.inserted_id})
    
    # Generate and store OTP
    otp = generate_otp()
    otp_expires_at = get_otp_expiry()
    
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "otp_code": otp,
                "otp_expires_at": otp_expires_at,
            }
        }
    )
    
    # Send OTP (console for dev, SMS for prod)
    send_otp(request.phone, otp)
    
    return LoginResponse(
        success=True,
        message=f"OTP sent to {request.phone}"
    )


@router.post("/verify", response_model=VerifyOTPResponse)
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify OTP and return JWT token
    """
    users = get_users_collection()
    
    # Find user
    user = await users.find_one({"phone": request.phone})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if OTP exists
    if not user.get("otp_code"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP requested. Please request OTP first."
        )
    
    # Verify OTP
    if user["otp_code"] != request.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    # Check OTP expiry
    if not is_otp_valid(user["otp_expires_at"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP expired. Please request a new one."
        )
    
    # Clear OTP and update last_seen
    await users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"last_seen": datetime.utcnow()},
            "$unset": {"otp_code": "", "otp_expires_at": ""}
        }
    )
    
    # Create JWT token
    token_data = {
        "user_id": str(user["_id"]),
        "role": user["role"],
    }
    
    if user.get("flat_id"):
        token_data["flat_id"] = user["flat_id"]
    
    token = create_access_token(token_data)
    
    # Prepare user response
    user_response = UserResponse(
        _id=str(user["_id"]),
        name=user["name"],
        phone=user["phone"],
        role=user["role"],
        flat_id=user.get("flat_id"),
        created_at=user["created_at"]
    )
    
    return VerifyOTPResponse(
        token=token,
        user=user_response
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    users = get_users_collection()
    
    from bson import ObjectId
    user = await users.find_one({"_id": ObjectId(current_user["user_id"])})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        _id=str(user["_id"]),
        name=user["name"],
        phone=user["phone"],
        role=user["role"],
        flat_id=user.get("flat_id"),
        created_at=user["created_at"]
    )

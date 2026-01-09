"""
Temporary QR Router - Generate and validate one-time guest passes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from database import get_temporary_qr_collection
from middleware.auth import get_current_owner, get_current_guard
from utils.jwt_utils import create_qr_token, decode_qr_token
from utils.qr_utils import generate_qr_image_with_details


router = APIRouter(prefix="/temp-qr", tags=["Temporary QR"])


# Request/Response Models
class GenerateTemporaryQRRequest(BaseModel):
    guest_name: Optional[str] = Field(None, max_length=100)
    validity_hours: int = Field(..., ge=1, le=72, description="Validity period in hours (1-72)")


class TemporaryQRResponse(BaseModel):
    _id: str
    owner_id: str
    guest_name: Optional[str]
    token: str
    qr_image_url: str
    expires_at: datetime
    one_time: bool
    created_at: datetime


class ValidateTemporaryQRResponse(BaseModel):
    valid: bool
    owner_id: Optional[str] = None
    guest_name: Optional[str] = None
    expires_at: Optional[datetime] = None
    error: Optional[str] = None


@router.post("/generate", response_model=TemporaryQRResponse, status_code=status.HTTP_201_CREATED)
async def generate_temporary_qr(
    request: GenerateTemporaryQRRequest,
    current_user: dict = Depends(get_current_owner)
):
    """
    Generate a temporary one-time QR code for a guest
    
    - **guest_name**: Name of the guest (optional)
    - **validity_hours**: How long the QR code is valid (1-72 hours)
    
    Returns QR code image and token
    """
    temp_qr_collection = get_temporary_qr_collection()
    
    # Calculate expiry
    expires_at = datetime.utcnow() + timedelta(hours=request.validity_hours)
    
    # Create temporary QR document
    temp_qr_doc = {
        "owner_id": current_user["user_id"],
        "guest_name": request.guest_name,
        "expires_at": expires_at,
        "one_time": True,
        "used_at": None,
        "created_at": datetime.utcnow()
    }
    
    # Insert document
    result = await temp_qr_collection.insert_one(temp_qr_doc)
    temp_qr_id = str(result.inserted_id)
    
    # Generate JWT token with expiry
    qr_token = create_qr_token(
        {
            "type": "temporary",
            "temp_qr_id": temp_qr_id,
            "owner_id": current_user["user_id"],
            "guest_name": request.guest_name
        },
        expires_delta=timedelta(hours=request.validity_hours)
    )
    
    # Update document with token
    await temp_qr_collection.update_one(
        {"_id": result.inserted_id},
        {"$set": {"token": qr_token}}
    )
    
    # Generate QR image with all details
    qr_image_url = generate_qr_image_with_details({
        "visitor_id": temp_qr_id,
        "name": request.guest_name or "Guest",
        "visitor_type": "temporary",
        "token": qr_token,
        "created_at": datetime.utcnow().isoformat()
    })
    
    return TemporaryQRResponse(
        _id=temp_qr_id,
        owner_id=current_user["user_id"],
        guest_name=request.guest_name,
        token=qr_token,
        qr_image_url=qr_image_url,
        expires_at=expires_at,
        one_time=True,
        created_at=temp_qr_doc["created_at"]
    )


@router.get("/{token}/validate", response_model=ValidateTemporaryQRResponse)
async def validate_temporary_qr(token: str):
    """
    Validate a temporary QR token
    
    Can be called by guards or publicly (token validation is sufficient)
    """
    temp_qr_collection = get_temporary_qr_collection()
    
    # Decode token
    payload = decode_qr_token(token)
    
    if not payload:
        return ValidateTemporaryQRResponse(
            valid=False,
            error="Invalid or expired token"
        )
    
    # Check token type
    if payload.get("type") != "temporary":
        return ValidateTemporaryQRResponse(
            valid=False,
            error="Invalid token type"
        )
    
    # Find temp QR record
    try:
        temp_qr = await temp_qr_collection.find_one({
            "_id": ObjectId(payload["temp_qr_id"])
        })
    except Exception:
        return ValidateTemporaryQRResponse(
            valid=False,
            error="Invalid QR ID"
        )
    
    if not temp_qr:
        return ValidateTemporaryQRResponse(
            valid=False,
            error="QR code not found"
        )
    
    # Check if already used
    if temp_qr.get("used_at"):
        return ValidateTemporaryQRResponse(
            valid=False,
            error="QR code already used"
        )
    
    # Check expiry
    if datetime.utcnow() > temp_qr["expires_at"]:
        return ValidateTemporaryQRResponse(
            valid=False,
            error="QR code expired"
        )
    
    return ValidateTemporaryQRResponse(
        valid=True,
        owner_id=temp_qr["owner_id"],
        guest_name=temp_qr.get("guest_name"),
        expires_at=temp_qr["expires_at"]
    )


@router.post("/{token}/mark-used", status_code=status.HTTP_200_OK)
async def mark_temporary_qr_used(
    token: str,
    current_user: dict = Depends(get_current_guard)
):
    """
    Mark a temporary QR as used
    
    Called by guard after successful entry
    """
    temp_qr_collection = get_temporary_qr_collection()
    
    # Decode token
    payload = decode_qr_token(token)
    
    if not payload or payload.get("type") != "temporary":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token"
        )
    
    # Mark as used
    result = await temp_qr_collection.update_one(
        {"_id": ObjectId(payload["temp_qr_id"])},
        {"$set": {"used_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR code not found"
        )
    
    return {"success": True, "message": "QR code marked as used"}


@router.get("/", response_model=list)
async def list_temporary_qrs(
    current_user: dict = Depends(get_current_owner)
):
    """
    List all temporary QR codes created by the current owner
    
    Shows both active and used QR codes
    """
    temp_qr_collection = get_temporary_qr_collection()
    
    cursor = temp_qr_collection.find({
        "owner_id": current_user["user_id"]
    }).sort("created_at", -1).limit(50)
    
    temp_qrs = await cursor.to_list(length=50)
    
    return [
        {
            "_id": str(qr["_id"]),
            "guest_name": qr.get("guest_name"),
            "expires_at": qr["expires_at"],
            "used_at": qr.get("used_at"),
            "is_active": qr.get("used_at") is None and datetime.utcnow() < qr["expires_at"],
            "created_at": qr["created_at"]
        }
        for qr in temp_qrs
    ]


# ===== GET ENDPOINTS FOR HORIZON QR MANAGEMENT =====

@router.get("/active", response_model=List[TemporaryQRResponse])
async def get_active_qr_codes(
    current_user: dict = Depends(get_current_owner)
):
    """
    Get all active (non-expired, unused) temporary QR codes for the current owner
    Used by Horizon QR generator history
    """
    temp_qr_collection = get_temporary_qr_collection()
    
    # Get all QR codes that haven't expired and haven't been used
    now = datetime.utcnow()
    
    qr_codes = await temp_qr_collection.find({
        "owner_id": str(current_user["_id"]),
        "expires_at": {"$gt": now},
        "used_at": None
    }).sort("created_at", -1).to_list(length=100)
    
    return [
        TemporaryQRResponse(
            _id=str(qr["_id"]),
            owner_id=qr["owner_id"],
            guest_name=qr.get("guest_name"),
            token=qr["token"],
            qr_image_url=f"/temp-qr/{qr['_id']}/qr-image",  # Placeholder
            expires_at=qr["expires_at"],
            one_time=qr.get("one_time", True),
            created_at=qr["created_at"]
        )
        for qr in qr_codes
    ]

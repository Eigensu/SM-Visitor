"""
Visitor Management Router - REST API for CRUD operations on visitors
Handles regular visitor management with QR code generation
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from database import get_visitors_collection
from middleware.auth import get_current_owner, get_current_user, get_current_guard
from utils.jwt_utils import create_qr_token
from utils.qr_utils import generate_qr_image_with_details
from utils.storage import photo_storage
from models import VisitorModel


router = APIRouter(prefix="/visitors", tags=["Visitors"])


# Helper Functions
def get_category_label(category: str) -> str:
    """Get display label for visitor category"""
    labels = {
        "maid": "Maid",
        "cook": "Cook",
        "driver": "Driver",
        "delivery": "Delivery",
        "other": "Other"
    }
    return labels.get(category, "Other")


def get_auto_approval_label(rule: str) -> str:
    """Get display label for auto-approval rule"""
    labels = {
        "always": "Always auto-approve",
        "within_schedule": "Auto-approve if within schedule",
        "notify_only": "Notify but don't block"
    }
    return labels.get(rule, "Always auto-approve")


def is_within_schedule(schedule: dict) -> bool:
    """Check if current time is within visitor's schedule"""
    if not schedule.get("enabled"):
        return True  # No schedule = always allowed
    
    try:
        import pytz
        from datetime import datetime
        
        # Get current day and time in IST
        ist = pytz.timezone("Asia/Kolkata")
        now = datetime.now(ist)
        current_day = now.isoweekday()  # 1=Monday, 7=Sunday
        current_time = now.strftime("%H:%M")
        
        # Check day of week
        days_of_week = schedule.get("days_of_week", [])
        if days_of_week and current_day not in days_of_week:
            return False
        
        # Check time windows
        time_windows = schedule.get("time_windows", [])
        if not time_windows:
            return True  # No time restriction
        
        for window in time_windows:
            start_time = window.get("start_time", "00:00")
            end_time = window.get("end_time", "23:59")
            if start_time <= current_time <= end_time:
                return True
        
        return False
    except Exception as e:
        print(f"[ERROR] Schedule validation failed: {str(e)}")
        return True  # Default to allowing if validation fails



# Request/Response Models
class CreateRegularVisitorRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    default_purpose: Optional[str] = Field(None, max_length=200)
    
    # Category
    category: str = Field(default="other", regex="^(maid|cook|driver|delivery|other)$")
    
    # Schedule fields
    schedule_enabled: bool = False
    schedule_days: Optional[List[int]] = Field(None, description="Days of week (1=Mon, 7=Sun)")
    schedule_start_time: Optional[str] = Field(None, regex="^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    schedule_end_time: Optional[str] = Field(None, regex="^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    
    # Auto-approval fields
    auto_approval_enabled: bool = True
    auto_approval_rule: str = Field(default="always", regex="^(always|within_schedule|notify_only)$")


class UpdateVisitorRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    default_purpose: Optional[str] = Field(None, max_length=200)


class VisitorResponse(BaseModel):
    _id: str
    name: str
    phone: Optional[str]
    photo_url: str
    visitor_type: str
    created_by: str
    default_purpose: Optional[str]
    qr_token: Optional[str]
    is_active: bool
    created_at: datetime


class VisitorWithQRResponse(VisitorResponse):
    qr_image_url: str


@router.post("/regular", response_model=VisitorWithQRResponse, status_code=status.HTTP_201_CREATED)
async def create_regular_visitor(
    request: CreateRegularVisitorRequest,
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_owner)
):
    """
    Create a regular visitor with QR code
    
    - **name**: Visitor's full name
    - **phone**: Phone number (optional)
    - **default_purpose**: Default purpose of visit (optional)
    - **photo**: Visitor photo (JPEG/PNG, max 5MB)
    
    Returns visitor details with QR code image
    """
    visitors = get_visitors_collection()
    
    # Validate and save photo to GridFS
    photo_data = await photo.read()
    is_valid, error_msg = photo_storage.validate_photo(photo_data)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Save photo to MongoDB GridFS
    photo_file_id = await photo_storage.save_regular_visitor_photo(
        photo_data,
        photo.filename or "visitor_photo.jpg"
    )
    
    # Create visitor document
    visitor_doc = {
        "name": request.name,
        "phone": request.phone,
        "photo_url": photo_file_id,  # GridFS file ID
        "visitor_type": "regular",
        "created_by": current_user["user_id"],
        "default_purpose": request.default_purpose,
        
        # Category
        "category": request.category,
        "category_label": get_category_label(request.category),
        
        # Schedule
        "schedule": {
            "enabled": request.schedule_enabled,
            "days_of_week": request.schedule_days or [],
            "time_windows": [{
                "start_time": request.schedule_start_time,
                "end_time": request.schedule_end_time
            }] if request.schedule_enabled and request.schedule_start_time and request.schedule_end_time else [],
            "timezone": "Asia/Kolkata"
        },
        
        # Auto-approval
        "auto_approval": {
            "enabled": request.auto_approval_enabled,
            "rule": request.auto_approval_rule,
            "rule_label": get_auto_approval_label(request.auto_approval_rule)
        },
        
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    
    # Insert visitor
    result = await visitors.insert_one(visitor_doc)
    visitor_id = str(result.inserted_id)
    
    # Generate QR token (JWT with visitor_id, no expiry for regular visitors)
    qr_token = create_qr_token({
        "type": "regular",
        "visitor_id": visitor_id,
        "created_by": current_user["user_id"]
    })
    
    # Update visitor with QR token
    await visitors.update_one(
        {"_id": result.inserted_id},
        {"$set": {"qr_token": qr_token}}
    )
    
    # Generate QR image with all visitor details
    qr_image_url = generate_qr_image_with_details({
        "visitor_id": visitor_id,
        "name": request.name,
        "phone": request.phone,
        "visitor_type": "regular",
        "token": qr_token,
        "created_at": datetime.utcnow().isoformat()
    })
    
    return VisitorWithQRResponse(
        _id=visitor_id,
        name=request.name,
        phone=request.phone,
        photo_url=photo_file_id,
        visitor_type="regular",
        created_by=current_user["user_id"],
        default_purpose=request.default_purpose,
        qr_token=qr_token,
        is_active=True,
        created_at=visitor_doc["created_at"],
        qr_image_url=qr_image_url
    )


@router.get("/{visitor_id}", response_model=VisitorResponse)
async def get_visitor(
    visitor_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get visitor details by ID
    
    Owners can only access their own visitors
    Guards can access any visitor
    """
    visitors = get_visitors_collection()
    
    try:
        visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visitor ID"
        )
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    # Check authorization (owners can only see their visitors)
    if current_user["role"] == "owner":
        if visitor["created_by"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return VisitorResponse(
        _id=str(visitor["_id"]),
        name=visitor["name"],
        phone=visitor.get("phone"),
        photo_url=visitor["photo_url"],
        visitor_type=visitor["visitor_type"],
        created_by=visitor["created_by"],
        default_purpose=visitor.get("default_purpose"),
        qr_token=visitor.get("qr_token"),
        is_active=visitor["is_active"],
        created_at=visitor["created_at"]
    )


@router.get("/", response_model=List[VisitorResponse])
async def list_visitors(
    owner_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List visitors
    
    - Owners see only their visitors
    - Admins can filter by owner_id or see all
    - Guards can see all active visitors
    """
    visitors = get_visitors_collection()
    
    # Build query
    query = {"is_active": True}
    
    if current_user["role"] == "owner":
        # Owners can only see their own visitors
        query["created_by"] = current_user["user_id"]
    elif owner_id:
        # Admin filtering by owner
        query["created_by"] = owner_id
    
    # Fetch visitors
    cursor = visitors.find(query).sort("created_at", -1)
    visitor_list = await cursor.to_list(length=100)
    
    return [
        VisitorResponse(
            _id=str(v["_id"]),
            name=v["name"],
            phone=v.get("phone"),
            photo_url=v["photo_url"],
            visitor_type=v["visitor_type"],
            created_by=v["created_by"],
            default_purpose=v.get("default_purpose"),
            qr_token=v.get("qr_token"),
            is_active=v["is_active"],
            created_at=v["created_at"]
        )
        for v in visitor_list
    ]


@router.patch("/{visitor_id}", response_model=VisitorResponse)
async def update_visitor(
    visitor_id: str,
    request: UpdateVisitorRequest,
    current_user: dict = Depends(get_current_owner)
):
    """
    Update visitor details
    
    Only the owner who created the visitor can update it
    """
    visitors = get_visitors_collection()
    
    try:
        visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visitor ID"
        )
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    # Check ownership
    if visitor["created_by"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build update document
    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.phone is not None:
        update_data["phone"] = request.phone
    if request.default_purpose is not None:
        update_data["default_purpose"] = request.default_purpose
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Update visitor
    await visitors.update_one(
        {"_id": ObjectId(visitor_id)},
        {"$set": update_data}
    )
    
    # Fetch updated visitor
    updated_visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})
    
    return VisitorResponse(
        _id=str(updated_visitor["_id"]),
        name=updated_visitor["name"],
        phone=updated_visitor.get("phone"),
        photo_url=updated_visitor["photo_url"],
        visitor_type=updated_visitor["visitor_type"],
        created_by=updated_visitor["created_by"],
        default_purpose=updated_visitor.get("default_purpose"),
        qr_token=updated_visitor.get("qr_token"),
        is_active=updated_visitor["is_active"],
        created_at=updated_visitor["created_at"]
    )


@router.delete("/{visitor_id}", status_code=status.HTTP_200_OK)
async def delete_visitor(
    visitor_id: str,
    current_user: dict = Depends(get_current_owner)
):
    """
    Soft delete a visitor (deactivate)
    
    This invalidates the QR code and prevents future visits
    """
    visitors = get_visitors_collection()
    
    try:
        visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visitor ID"
        )
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    # Check ownership
    if visitor["created_by"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Soft delete (set is_active to False)
    await visitors.update_one(
        {"_id": ObjectId(visitor_id)},
        {"$set": {"is_active": False}}
    )
    
    return {"success": True, "message": "Visitor deactivated successfully"}


@router.get("/{visitor_id}/qr", response_model=dict)
async def get_visitor_qr(
    visitor_id: str,
    current_user: dict = Depends(get_current_owner)
):
    """
    Regenerate QR code for a visitor
    
    Useful if QR code needs to be reprinted or shared again
    """
    visitors = get_visitors_collection()
    
    try:
        visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visitor ID"
        )
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    # Check ownership
    if visitor["created_by"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not visitor["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Visitor is deactivated"
        )
    
    # Generate QR image
    qr_image_url = generate_qr_image_with_details({
        "visitor_id": visitor_id,
        "name": visitor["name"],
        "phone": visitor.get("phone"),
        "visitor_type": visitor["visitor_type"],
        "token": visitor["qr_token"],
        "created_at": visitor["created_at"].isoformat()
    })
    
    return {
        "visitor_id": visitor_id,
        "qr_image_url": qr_image_url,
        "qr_token": visitor["qr_token"]
    }


# ===== GET ENDPOINTS FOR HORIZON VISITOR MANAGEMENT =====

@router.get("/regular", response_model=List[VisitorResponse])
async def get_regular_visitors(
    current_user: dict = Depends(get_current_owner)
):
    """
    Get all regular visitors for the current owner
    Used by Horizon visitors page
    """
    visitors_collection = get_visitors_collection()
    
    visitors = await visitors_collection.find({
        "created_by": str(current_user["_id"]),
        "visitor_type": "regular",
        "is_active": True
    }).sort("created_at", -1).to_list(length=1000)
    
    return [
        VisitorResponse(
            _id=str(visitor["_id"]),
            name=visitor["name"],
            phone=visitor.get("phone"),
            photo_url=visitor["photo_url"],
            visitor_type=visitor["visitor_type"],
            created_by=visitor["created_by"],
            default_purpose=visitor.get("default_purpose"),
            qr_token=visitor.get("qr_token"),
            is_active=visitor["is_active"],
            created_at=visitor["created_at"]
        )
        for visitor in visitors
    ]


@router.get("/regular/count")
async def get_regular_count(
    current_user: dict = Depends(get_current_owner)
):
    """
    Get count of active regular visitors for the current owner
    Used by Horizon dashboard stats
    """
    visitors_collection = get_visitors_collection()
    
    count = await visitors_collection.count_documents({
        "created_by": str(current_user["_id"]),
        "visitor_type": "regular",
        "is_active": True
    })
    
    return {"count": count}


@router.get("/regular/{visitor_id}", response_model=VisitorResponse)
async def get_visitor_by_id(
    visitor_id: str,
    current_user: dict = Depends(get_current_owner)
):
    """
    Get a specific regular visitor by ID
    Used by Horizon visitor details page
    """
    visitors_collection = get_visitors_collection()
    
    try:
        visitor = await visitors_collection.find_one({
            "_id": ObjectId(visitor_id),
            "created_by": str(current_user["_id"])
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visitor ID"
        )
    
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor not found"
        )
    
    return VisitorResponse(
        _id=str(visitor["_id"]),
        name=visitor["name"],
        phone=visitor.get("phone"),
        photo_url=visitor["photo_url"],
        visitor_type=visitor["visitor_type"],
        created_by=visitor["created_by"],
        default_purpose=visitor.get("default_purpose"),
        qr_token=visitor.get("qr_token"),
        is_active=visitor["is_active"],
        created_at=visitor["created_at"]
    )

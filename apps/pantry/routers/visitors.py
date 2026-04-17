from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from database import get_visitors_collection, get_database
from middleware.auth import get_current_owner, get_current_user, get_current_guard
from utils.jwt_utils import create_qr_token
from utils.qr_utils import generate_qr_image_with_details
from utils.storage import photo_storage
from utils.sse_manager import sse_manager
from utils.time_utils import get_ist_now, get_utc_now
from models import VisitorModel, ApprovalStatus
from services.serializers.visitor import serialize_visitor
from utils.auth_helpers import get_user_id
from services.identity_service import get_owner_by_flat

router = APIRouter(prefix="/visitors", tags=["Visitors"])


# Request/Response Models
class CreateRegularVisitorRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    default_purpose: Optional[str] = Field(None, max_length=200)
    # Backward compatible with older clients; photo is now uploaded as multipart file.
    photo_id: Optional[str] = None

    # Category
    category: str = Field(
        default="other", pattern="^(maid|cook|driver|delivery|other)$"
    )

    # Schedule fields
    schedule_enabled: bool = False
    schedule_days: Optional[List[int]] = Field(
        None, description="Days of week (1=Mon, 7=Sun)"
    )
    schedule_start_time: Optional[str] = Field(
        None, pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
    )
    schedule_end_time: Optional[str] = Field(
        None, pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
    )

    # Auto-approval fields
    auto_approval_enabled: bool = True
    auto_approval_rule: str = Field(
        default="always", pattern="^(always|within_schedule|notify_only)$"
    )

    # Expiration (Permanent vs Temporary)
    qr_validity_hours: Optional[int] = Field(
        None, description="6, 12, 18, or 24 hours. None means permanent."
    )

    # Assignment (for Guard-initiated requests)
    flat_id: Optional[str] = None

    # Flat targeting (for Owner-initiated requests)
    is_all_flats: bool = False
    valid_flats: Optional[List[str]] = None


class UpdateVisitorRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    default_purpose: Optional[str] = Field(None, max_length=200)
    is_all_flats: Optional[bool] = None
    valid_flats: Optional[List[str]] = None


def get_category_label(category: str) -> str:
    mapping = {
        "maid": "Maid",
        "cook": "Cook",
        "driver": "Driver",
        "delivery": "Delivery",
        "other": "Other Staff",
    }
    return mapping.get(category, "Staff")


def get_auto_approval_label(rule: str) -> str:
    mapping = {
        "always": "Always",
        "within_schedule": "Within Schedule",
        "notify_only": "Notify Only",
    }
    return mapping.get(rule, "Standard")


def get_owner_id_variants(user_id: str) -> list[object]:
    variants = [user_id]
    if ObjectId.is_valid(user_id):
        variants.append(ObjectId(user_id))
    return variants


async def get_current_owner_flat_id(current_user: dict) -> Optional[str]:
    flat_id = current_user.get("flat_id")
    if isinstance(flat_id, str) and flat_id.strip():
        return flat_id

    user_id = get_user_id(current_user)
    if not ObjectId.is_valid(user_id):
        return None

    db = get_database()
    owner = await db.residents.find_one({"_id": ObjectId(user_id)})
    if owner and isinstance(owner.get("flat_id"), str):
        return owner["flat_id"]
    return None


async def build_owner_regular_access_filter(current_user: dict) -> dict:
    user_id = get_user_id(current_user)
    owner_candidates = get_owner_id_variants(user_id)
    owner_flat_id = await get_current_owner_flat_id(current_user)

    if owner_flat_id:
        return {
            "$or": [
                {"assigned_owner_id": {"$in": owner_candidates}},
                {"is_all_flats": True, "valid_flats": owner_flat_id},
            ]
        }

    return {"assigned_owner_id": {"$in": owner_candidates}}


async def get_visitor_request(
    name: str = Form(...),
    phone: Optional[str] = Form(None),
    category: str = Form("other"),
    flat_id: Optional[str] = Form(None),
    default_purpose: Optional[str] = Form(None),
    schedule_enabled: bool = Form(False),
    schedule_days: Optional[List[int]] = Form(None),
    schedule_start_time: Optional[str] = Form(None),
    schedule_end_time: Optional[str] = Form(None),
    auto_approval_enabled: bool = Form(True),
    auto_approval_rule: str = Form("always"),
    qr_validity_hours: Optional[int] = Form(None),
    is_all_flats: bool = Form(False),
    valid_flats: Optional[List[str]] = Form(None),
) -> CreateRegularVisitorRequest:
    # Convert empty strings to None for optional fields
    # This prevents Pydantic min_length validation errors for blank form fields
    s_phone = phone if phone and phone.strip() else None
    s_flat_id = flat_id if flat_id and flat_id.strip() else None
    s_default_purpose = (
        default_purpose if default_purpose and default_purpose.strip() else None
    )
    s_start_time = (
        schedule_start_time
        if schedule_start_time and schedule_start_time.strip()
        else None
    )
    s_end_time = (
        schedule_end_time if schedule_end_time and schedule_end_time.strip() else None
    )

    return CreateRegularVisitorRequest(
        name=name,
        phone=s_phone,
        category=category,
        flat_id=s_flat_id,
        default_purpose=s_default_purpose,
        schedule_enabled=schedule_enabled,
        schedule_days=schedule_days,
        schedule_start_time=s_start_time,
        schedule_end_time=s_end_time,
        auto_approval_enabled=auto_approval_enabled,
        auto_approval_rule=auto_approval_rule,
        qr_validity_hours=qr_validity_hours,
        is_all_flats=is_all_flats,
        valid_flats=valid_flats,
    )


class VisitorResponse(BaseModel):
    id: str  # serializer returns 'id' key, matching this field exactly
    name: str
    phone: Optional[str] = None
    photo_url: str
    visitor_type: str
    created_by: str
    default_purpose: Optional[str] = None
    qr_token: Optional[str] = None
    is_active: bool
    approval_status: ApprovalStatus
    assigned_owner_id: Optional[str] = None
    created_by_role: str
    created_at: datetime
    qr_validity_hours: Optional[int] = None
    qr_expires_at: Optional[datetime] = None


class VisitorWithQRResponse(VisitorResponse):
    qr_image_url: str
    is_all_flats: bool = False
    valid_flats: Optional[List[str]] = None


@router.post(
    "/regular",
    response_model=VisitorWithQRResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_regular_visitor(
    request: CreateRegularVisitorRequest = Depends(get_visitor_request),
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_owner),
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
    is_valid, error_msg = await photo_storage.validate_photo(photo_data)

    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    # Save photo to MongoDB GridFS
    photo_file_id = await photo_storage.save_regular_visitor_photo(
        photo_data, photo.filename or "visitor_photo.jpg"
    )

    # Create visitor document
    visitor_doc = {
        "name": request.name,
        "phone": request.phone,
        "photo_url": photo_file_id,  # GridFS file ID
        "visitor_type": "regular",
        "created_by": get_user_id(current_user),
        "default_purpose": request.default_purpose,
        # Category
        "category": request.category,
        "category_label": get_category_label(request.category),
        # Schedule
        "schedule": {
            "enabled": request.schedule_enabled,
            "days_of_week": request.schedule_days or [],
            "time_windows": (
                [
                    {
                        "start_time": request.schedule_start_time,
                        "end_time": request.schedule_end_time,
                    }
                ]
                if request.schedule_enabled
                and request.schedule_start_time
                and request.schedule_end_time
                else []
            ),
            "timezone": "Asia/Kolkata",
        },
        # Auto-approval
        "auto_approval": {
            "enabled": request.auto_approval_enabled,
            "rule": request.auto_approval_rule,
            "rule_label": get_auto_approval_label(request.auto_approval_rule),
        },
        # Flat targeting
        "is_all_flats": request.is_all_flats,
        "valid_flats": request.valid_flats or [],
        "is_active": True,
        "approval_status": "approved",
        "assigned_owner_id": None,
        "created_by_role": "owner",
        "created_at": get_utc_now(),
    }

    # Insert visitor
    result = await visitors.insert_one(visitor_doc)
    visitor_id = str(result.inserted_id)

    # Generate QR token (JWT with visitor_id, no expiry for regular visitors)
    qr_token = create_qr_token(
        {
            "type": "regular",
            "visitor_id": visitor_id,
            "created_by": get_user_id(current_user),
        }
    )

    # Update visitor with QR token
    await visitors.update_one(
        {"_id": result.inserted_id}, {"$set": {"qr_token": qr_token}}
    )

    # FIX: Offload CPU-intensive QR generation
    import asyncio

    qr_image_url = await asyncio.to_thread(
        generate_qr_image_with_details,
        {
            "visitor_id": visitor_id,
            "name": request.name,
            "phone": request.phone,
            "visitor_type": "regular",
            "token": qr_token,
            "created_at": get_ist_now().isoformat(),
        },
    )


@router.post(
    "/regular/guard",
    response_model=VisitorResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_regular_visitor_by_guard(
    request: CreateRegularVisitorRequest = Depends(get_visitor_request),
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_guard),
):
    """
    Initiate a regular visitor registration by a guard
    Requires owner approval before activation
    """
    # Guard Authorization Check
    if current_user.get("role") != "guard":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only guards can initiate regular visitor registration",
        )

    if not request.flat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="flat_id is required for guard-initiated registrations",
        )

    # Validate validity hours if provided
    if request.qr_validity_hours:
        if request.qr_validity_hours not in [6, 12, 18, 24]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid validity duration. Must be 6, 12, 18 or 24 hours.",
            )

    request_flat_id = request.flat_id.strip()
    is_broadcast = request_flat_id.lower() == "all"

    resolved_owner_id = None
    target_owner_ids: list[str] = []
    valid_flats: list[str] = []

    if is_broadcast:
        db = get_database()
        valid_flats = [
            flat
            for flat in await db.residents.distinct("flat_id", {"role": "owner"})
            if isinstance(flat, str) and flat.strip()
        ]

        if not valid_flats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No owner flats available for broadcast approval.",
            )

        owners = await db.residents.find(
            {"role": "owner", "flat_id": {"$in": valid_flats}}, {"_id": 1}
        ).to_list(length=500)
        target_owner_ids = [str(owner["_id"]) for owner in owners]
    else:
        # Resolve ownership safely on backend
        owner = await get_owner_by_flat(request_flat_id)
        if not owner:
            print(
                f"[OWNER RESOLUTION FAILED] flat_id={request.flat_id} has no valid owner."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid owner assignment. Flat not found or has no active owner.",
            )

        resolved_owner_id = str(owner["_id"])
        target_owner_ids = [resolved_owner_id]

    visitors = get_visitors_collection()

    # Save photo
    photo_data = await photo.read()
    photo_file_id = await photo_storage.save_regular_visitor_photo(
        photo_data, photo.filename or "visitor_photo.jpg"
    )

    # Create visitor document (inactive)
    visitor_doc = {
        "name": request.name,
        "phone": request.phone,
        "photo_url": photo_file_id,
        "visitor_type": "regular",
        "created_by": get_user_id(current_user),
        "created_by_role": "guard",
        "assigned_owner_id": resolved_owner_id,
        "flat_id": request_flat_id,  # Persist flat_id for flat-level queries
        "is_all_flats": is_broadcast,
        "valid_flats": valid_flats,
        "approval_status": "pending",
        "is_active": False,
        "default_purpose": request.default_purpose,
        "category": request.category,
        "category_label": get_category_label(request.category),
        "schedule": {
            "enabled": request.schedule_enabled,
            "days_of_week": request.schedule_days or [],
            "time_windows": (
                [
                    {
                        "start_time": request.schedule_start_time,
                        "end_time": request.schedule_end_time,
                    }
                ]
                if request.schedule_enabled
                else []
            ),
            "timezone": "Asia/Kolkata",
        },
        "auto_approval": {
            "enabled": request.auto_approval_enabled,
            "rule": request.auto_approval_rule,
            "rule_label": get_auto_approval_label(request.auto_approval_rule),
        },
        "created_at": get_utc_now(),
    }

    result = await visitors.insert_one(visitor_doc)
    visitor_id = str(result.inserted_id)

    # Notify Owner via SSE (Hardened Name)
    from utils.sse_manager import sse_manager

    event_payload = {
        "visitor_id": str(visitor_id),
        "name": request.name,
        "phone": request.phone,
        "category": request.category,
        "photo_url": photo_file_id,
        "guard_id": get_user_id(current_user),
        "qr_validity_hours": request.qr_validity_hours,
        "flat_id": request_flat_id,
        "is_all_flats": is_broadcast,
    }

    for owner_id in target_owner_ids:
        await sse_manager.send_event(owner_id, "NEW_VISITOR_REQUEST", event_payload)

    return serialize_visitor(visitor_doc | {"_id": visitor_id})


@router.get("/approvals/regular", response_model=List[VisitorResponse])
async def get_pending_regular_visitors(current_user: dict = Depends(get_current_owner)):
    """Get regular visitors pending approval for the current owner"""
    visitors = get_visitors_collection()

    owner_access_filter = await build_owner_regular_access_filter(current_user)

    query = {
        **owner_access_filter,
        "approval_status": "pending",
        "visitor_type": "regular",
    }

    # ==== APPROVAL DEBUG ====
    print(f"[APPROVAL QUERY] user_id={get_user_id(current_user)}")
    print(f"[APPROVAL QUERY] filter={query}")

    results = []
    async for doc in visitors.find(query):
        results.append(serialize_visitor(doc))

    print(f"[APPROVAL RESULT] count={len(results)}")
    if not results:
        print(
            "[ALERT] Empty result where pending approval data expected — check DB write or query."
        )

    return results


@router.get("/history/regular", response_model=List[VisitorResponse])
async def get_regular_history_visitors(current_user: dict = Depends(get_current_owner)):
    """Get regular visitors that were approved or rejected for the current owner"""
    visitors = get_visitors_collection()

    owner_access_filter = await build_owner_regular_access_filter(current_user)

    query = {
        **owner_access_filter,
        "approval_status": {"$in": ["approved", "rejected"]},
        "visitor_type": "regular",
    }

    results = []
    async for visitor in visitors.find(query).sort("created_at", -1).limit(50):
        results.append(serialize_visitor(visitor))

    return results


@router.patch("/{visitor_id}/approve-regular", response_model=VisitorWithQRResponse)
async def approve_regular_visitor(
    visitor_id: str, current_user: dict = Depends(get_current_owner)
):
    """Approve a guard-initiated regular visitor registration"""
    visitors = get_visitors_collection()
    owner_access_filter = await build_owner_regular_access_filter(current_user)

    visitor = await visitors.find_one(
        {
            "_id": ObjectId(visitor_id),
            **owner_access_filter,
        }
    )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Visitor request not found"
        )

    # Compute expiration for temporary visitors at approval time
    from datetime import timedelta

    expires_at = None
    if visitor.get("qr_validity_hours"):
        expires_at = get_utc_now() + timedelta(hours=int(visitor["qr_validity_hours"]))

    # Generate QR
    qr_token = create_qr_token(
        {
            "type": "regular",
            "visitor_id": visitor_id,
            "created_by": visitor.get("created_by"),
        }
    )

    # Update to active
    await visitors.update_one(
        {"_id": ObjectId(visitor_id)},
        {
            "$set": {
                "approval_status": "approved",
                "is_active": True,
                "qr_token": qr_token,
                "qr_expires_at": expires_at,
            }
        },
    )

    # FIX: Offload CPU-intensive QR generation
    import asyncio

    qr_image_url = await asyncio.to_thread(
        generate_qr_image_with_details,
        {
            "visitor_id": visitor_id,
            "name": visitor["name"],
            "phone": visitor.get("phone"),
            "visitor_type": "regular",
            "token": qr_token,
            "created_at": get_ist_now().isoformat(),
        },
    )

    # Notify Guard via SSE (Hardened Name)
    from utils.sse_manager import sse_manager

    await sse_manager.send_event(
        visitor["created_by"],
        "VISITOR_APPROVED",
        {
            "visitor_id": visitor_id,
            "visitor_name": visitor["name"],
            "qr_token": qr_token,
        },
    )

    return VisitorWithQRResponse(
        **serialize_visitor(
            visitor
            | {
                "approval_status": ApprovalStatus.APPROVED,
                "is_active": True,
                "qr_token": qr_token,
            }
        ),
        qr_image_url=qr_image_url,
    )


@router.patch("/{visitor_id}/reject-regular")
async def reject_regular_visitor(
    visitor_id: str, current_user: dict = Depends(get_current_owner)
):
    """Reject a guard-initiated regular visitor registration"""
    visitors = get_visitors_collection()
    owner_access_filter = await build_owner_regular_access_filter(current_user)

    visitor = await visitors.find_one(
        {
            "_id": ObjectId(visitor_id),
            **owner_access_filter,
        }
    )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visitor request not found or not assigned to you",
        )

    await visitors.update_one(
        {"_id": ObjectId(visitor_id)},
        {"$set": {"approval_status": "rejected", "is_active": False}},
    )

    # Notify the guard who submitted this request
    from utils.sse_manager import sse_manager

    guard_id = str(visitor.get("created_by", ""))
    if guard_id:
        await sse_manager.send_event(
            guard_id,
            "VISITOR_REJECTED",
            {
                "visitor_id": visitor_id,
                "visitor_name": visitor["name"],
            },
        )

    return {"message": "Visitor registration rejected", "visitor_id": visitor_id}


@router.get("/regular", response_model=List[VisitorResponse])
async def get_regular_visitors(current_user: dict = Depends(get_current_owner)):
    """
    Get all regular visitors for the current owner
    Used by Horizon visitors page
    """
    visitors_collection = get_visitors_collection()
    user_id = get_user_id(current_user)

    visitors = (
        await visitors_collection.find(
            {
                "created_by": {"$in": [user_id, ObjectId(user_id)]},
                "visitor_type": "regular",
                "is_active": True,
            }
        )
        .sort("created_at", -1)
        .to_list(length=1000)
    )

    return [serialize_visitor(visitor) for visitor in visitors]


@router.get("/{visitor_id}", response_model=VisitorResponse)
async def get_visitor(visitor_id: str, current_user: dict = Depends(get_current_user)):
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor ID"
        )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found"
        )

    # Check authorization (owners can only see their visitors)
    if current_user["role"] == "owner":
        if visitor["created_by"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
            )

    return serialize_visitor(visitor)


@router.get("/", response_model=List[VisitorResponse])
async def list_visitors(
    owner_id: Optional[str] = None, current_user: dict = Depends(get_current_user)
):
    """
    List visitors

    - Owners see only their visitors
    - Admins can filter by owner_id or see all
    - Guards can see all active visitors
    """
    visitors = get_visitors_collection()

    # Build query
    if current_user["role"] == "guard":
        # Guards can see active ones OR pending regulars
        query = {
            "$or": [
                {"is_active": True},
                {"visitor_type": "regular", "approval_status": "pending"},
            ]
        }
    else:
        # Default to active only
        query = {"is_active": True}

    if current_user["role"] == "owner":
        # Owners can only see their own visitors
        user_id = get_user_id(current_user)
        query["created_by"] = {"$in": [user_id, ObjectId(user_id)]}
    elif owner_id:
        # Admin filtering by owner
        query["created_by"] = owner_id

    # Fetch visitors
    cursor = visitors.find(query).sort("created_at", -1)
    visitor_list = await cursor.to_list(length=100)

    return [serialize_visitor(v) for v in visitor_list]


@router.patch("/{visitor_id}", response_model=VisitorResponse)
async def update_visitor(
    visitor_id: str,
    request: UpdateVisitorRequest,
    current_user: dict = Depends(get_current_owner),
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor ID"
        )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found"
        )

    # Check ownership
    if visitor["created_by"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
        )

    # Update visitor
    await visitors.update_one({"_id": ObjectId(visitor_id)}, {"$set": update_data})

    # Fetch updated visitor
    updated_visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})

    return serialize_visitor(updated_visitor)


@router.delete("/{visitor_id}", status_code=status.HTTP_200_OK)
@router.delete("/regular/{visitor_id}", status_code=status.HTTP_200_OK)
async def delete_visitor(
    visitor_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Consolidated Delete:
    - Guards/Admins: Can delete/deactivate any visitor
    - Owners: Can deactivate their own visitors
    """
    user_name = current_user.get("name", "Unknown")
    user_role = str(current_user.get("role", "")).lower()
    user_id = get_user_id(current_user)

    # CRITICAL: Diagnostic log (Must match FastAPI log for confirmation)
    print(
        f"\n[UNIFIED DELETE] Visitor: {visitor_id} | User: {user_name} | Role: {user_role}"
    )

    visitors = get_visitors_collection()

    try:
        visitor = await visitors.find_one({"_id": ObjectId(visitor_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor ID"
        )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found"
        )

    is_guard = user_role == "guard"
    is_admin = user_role == "admin"

    # Permission logic
    if not is_guard and not is_admin:
        # If not guard/admin, must be owner of the visitor
        owner_id = str(visitor.get("assigned_owner_id") or "")
        creator_id = str(visitor.get("created_by") or "")

        if str(user_id) not in [owner_id, creator_id]:
            print(
                f"[ACCESS DENOED] Owner check failed. UserID: {user_id} | OwnerID: {owner_id} | CreatorID: {creator_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
            )

    # ACTION:
    # If pending or guard-initiated, we perform a HARD DELETE
    # If active/history, we perform a SOFT DELETE (deactivate)

    if visitor.get("approval_status") == "pending" or user_role == "guard":
        print(f"[ACTION] HARD DELETE (Pending/Guard) for: {visitor_id}")
        await visitors.delete_one({"_id": ObjectId(visitor_id)})
        return {"status": "deleted", "id": visitor_id}
    else:
        print(f"[ACTION] SOFT DELETE (Deactivate) for: {visitor_id}")
        await visitors.update_one(
            {"_id": ObjectId(visitor_id)},
            {"$set": {"is_active": False, "approval_status": "deleted"}},
        )
        return {"status": "deactivated", "id": visitor_id}


@router.get("/{visitor_id}/qr", response_model=dict)
async def get_visitor_qr(
    visitor_id: str, current_user: dict = Depends(get_current_owner)
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor ID"
        )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found"
        )

    # Check ownership
    if visitor["created_by"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    if not visitor["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Visitor is deactivated"
        )

    # Generate QR image
    import asyncio

    qr_image_url = await asyncio.to_thread(
        generate_qr_image_with_details,
        {
            "visitor_id": visitor_id,
            "name": visitor["name"],
            "phone": visitor.get("phone"),
            "visitor_type": visitor["visitor_type"],
            "token": visitor["qr_token"],
            "created_at": visitor["created_at"].isoformat(),
        },
    )

    return {
        "visitor_id": visitor_id,
        "qr_image_url": qr_image_url,
        "qr_token": visitor["qr_token"],
    }


# ===== GET ENDPOINTS FOR HORIZON VISITOR MANAGEMENT =====


@router.get("/regular/count")
async def get_regular_count(current_user: dict = Depends(get_current_owner)):
    """
    Get count of active regular visitors for the current owner
    Used by Horizon dashboard stats
    """
    visitors_collection = get_visitors_collection()
    user_id = get_user_id(current_user)

    count = await visitors_collection.count_documents(
        {
            "created_by": {"$in": [user_id, ObjectId(user_id)]},
            "visitor_type": "regular",
            "is_active": True,
        }
    )

    return {"count": count}


@router.delete("/{visitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_regular_visitor(
    visitor_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Delete a regular visitor record
    """
    # CRITICAL: Always log at start to confirm we entered the function
    user_name = current_user.get("name", "Unknown")
    user_role = str(current_user.get("role", "")).lower()
    user_id = get_user_id(current_user)

    print(
        f"\n[STRICT DELETE] Visitor: {visitor_id} | User: {user_name} | Role: {user_role}"
    )

    visitors_collection = get_visitors_collection()

    try:
        obj_id = ObjectId(visitor_id)
        visitor = await visitors_collection.find_one({"_id": obj_id})
    except Exception as e:
        print(f"[STRICT DELETE] Invalid ID format: {visitor_id}")
        raise HTTPException(status_code=400, detail="Invalid ID")

    if not visitor:
        print(f"[STRICT DELETE] Not Found in DB: {visitor_id}")
        raise HTTPException(status_code=404, detail="Not Found")

    # Permissions Logic
    is_guard = user_role == "guard"
    is_admin = user_role == "admin"
    is_owner_assigned = str(visitor.get("assigned_owner_id")) == user_id
    is_creator = str(visitor.get("created_by")) == user_id

    # LOG the decision matrix
    print(
        f"[STRICT DELETE] Logic: guard={is_guard}, admin={is_admin}, creator={is_creator}, owner={is_owner_assigned}"
    )

    # GUARANTEED PASS FOR GUARDS AND ADMINS
    if is_guard or is_admin:
        print(f"[STRICT DELETE] Role match! Deleting...")
        await visitors_collection.delete_one({"_id": obj_id})
        return None

    # Check ownership for others
    if is_creator or is_owner_assigned:
        print(f"[STRICT DELETE] Ownership match! Deleting...")
        await visitors_collection.delete_one({"_id": obj_id})
        return None

    print(f"[STRICT DELETE] DENIED - User role '{user_role}' is not authorized")
    raise HTTPException(status_code=403, detail="Access Denied")


@router.get("/regular/{visitor_id}", response_model=VisitorResponse)
async def get_visitor_by_id(
    visitor_id: str, current_user: dict = Depends(get_current_owner)
):
    """
    Get a specific regular visitor by ID
    Used by Horizon visitor details page
    """
    visitors_collection = get_visitors_collection()
    user_id = get_user_id(current_user)
    try:
        visitor = await visitors_collection.find_one(
            {
                "_id": ObjectId(visitor_id),
                "created_by": {"$in": [user_id, ObjectId(user_id)]},
            }
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor ID"
        )

    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found"
        )

    return serialize_visitor(visitor)

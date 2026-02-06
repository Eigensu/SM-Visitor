"""
Visit Lifecycle Router - Handle QR scanning, visit creation, approval/rejection, and checkout
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import random

from database import get_visits_collection, get_visitors_collection, get_temporary_qr_collection, get_database
from middleware.auth import get_current_guard, get_current_owner, get_current_user
from utils.jwt_utils import decode_qr_token
from utils.qr_utils import parse_qr_data
from utils.sse_manager import sse_manager
from utils.time_utils import is_within_schedule


router = APIRouter(prefix="/visits", tags=["Visits"])


# Request/Response Models
class QRScanRequest(BaseModel):
    qr_token: str


class QRScanResponse(BaseModel):
    valid: bool
    auto_approve: bool
    visitor_data: Optional[dict] = None
    error: Optional[str] = None


class StartVisitQRRequest(BaseModel):
    qr_token: str
    owner_id: str
    purpose: Optional[str] = None


class StartVisitNewRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    photo_url: str  # Local buffer path
    owner_id: str
    purpose: str = Field(..., min_length=1, max_length=200)


class VisitResponse(BaseModel):
    id: str
    visitor_id: Optional[str]
    name_snapshot: str
    phone_snapshot: Optional[str]
    photo_snapshot_url: Optional[str]  # Made optional to handle temp QR codes
    purpose: str
    owner_id: str
    guard_id: str
    entry_time: Optional[datetime]
    exit_time: Optional[datetime]
    status: str
    qr_token: Optional[str] = None
    is_all_flats: bool = False
    valid_flats: Optional[List[str]] = None
    target_flat_ids: Optional[List[str]] = None
    created_at: datetime


@router.post("/qr-scan", response_model=QRScanResponse)
async def scan_qr_code(
    request: QRScanRequest,
    current_user: dict = Depends(get_current_guard)
):
    """
    Scan and validate a QR code
    
    Returns visitor details and whether auto-approval is granted
    """
    # Decode QR token
    payload = decode_qr_token(request.qr_token)
    
    if not payload:
        return QRScanResponse(
            valid=False,
            auto_approve=False,
            error="Invalid or expired QR code"
        )
    
    token_type = payload.get("type")
    
    # Handle regular visitor QR
    if token_type == "regular":
        visitors = get_visitors_collection()
        
        try:
            visitor = await visitors.find_one({
                "_id": ObjectId(payload["visitor_id"])
            })
        except Exception:
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="Invalid visitor ID"
            )
        
        if not visitor:
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="Visitor not found"
            )
        
        if not visitor["is_active"]:
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="Visitor has been deactivated"
            )
        
        # Check schedule
        schedule = visitor.get("schedule", {})
        within_schedule = is_within_schedule(schedule)
        
        # Determine auto-approval based on rules
        auto_approval_config = visitor.get("auto_approval", {})
        auto_approval_rule = auto_approval_config.get("rule", "always")
        
        if auto_approval_rule == "always":
            auto_approve = True
        elif auto_approval_rule == "within_schedule":
            auto_approve = within_schedule
        elif auto_approval_rule == "notify_only":
            auto_approve = True  # Always approve but will notify owner
        else:
            auto_approve = True  # Default to auto-approve
        
        return QRScanResponse(
            valid=True,
            auto_approve=auto_approve,
            visitor_data={
                "visitor_id": str(visitor["_id"]),
                "name": visitor["name"],
                "phone": visitor.get("phone"),
                "photo_url": visitor["photo_url"],
                "purpose": visitor.get("default_purpose", "Visit"),
                "visitor_type": "regular",
                "category": visitor.get("category", "other"),
                "category_label": visitor.get("category_label", "Other"),
                "within_schedule": within_schedule,
                "auto_approval_rule": auto_approval_rule
            }
        )
    
    # Handle temporary QR
    elif token_type == "temporary":
        temp_qr_collection = get_temporary_qr_collection()
        
        try:
            temp_qr = await temp_qr_collection.find_one({
                "_id": ObjectId(payload["temp_qr_id"])
            })
        except Exception:
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="Invalid temporary QR ID"
            )
        
        if not temp_qr:
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="Temporary QR not found"
            )
        
        if temp_qr.get("used_at"):
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="QR code already used"
            )
        
        if datetime.utcnow() > temp_qr["expires_at"]:
            return QRScanResponse(
                valid=False,
                auto_approve=False,
                error="QR code expired"
            )
        
        return QRScanResponse(
            valid=True,
            auto_approve=True,
            visitor_data={
                "temp_qr_id": str(temp_qr["_id"]),
                "name": temp_qr.get("guest_name", "Guest"),
                "owner_id": temp_qr["owner_id"],
                "purpose": "Guest visit",
                "visitor_type": "temporary",
                "expires_at": temp_qr["expires_at"].isoformat()
            }
        )
    
    return QRScanResponse(
        valid=False,
        auto_approve=False,
        error="Unknown QR code type"
    )


@router.post("/start", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def start_visit(
    qr_request: Optional[StartVisitQRRequest] = Body(None),
    new_request: Optional[StartVisitNewRequest] = Body(None),
    current_user: dict = Depends(get_current_guard),
    db = Depends(get_database)
):
    """
    Start a visit
    
    Two modes:
    1. QR flow: Provide qr_token, owner_id, and optional purpose
    2. New visitor: Provide name, phone, photo_url, owner_id, and purpose
    """
    visits = get_visits_collection()
    
    # Validate that exactly one request type is provided
    if (qr_request is None and new_request is None) or (qr_request is not None and new_request is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either qr_request or new_request, not both"
        )
    
    # Handle QR flow
    if qr_request:
        # Validate QR first
        payload = decode_qr_token(qr_request.qr_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid QR code"
            )
        
        token_type = payload.get("type")
        
        if token_type == "regular":
            visitors = get_visitors_collection()
            visitor = await visitors.find_one({"_id": ObjectId(payload["visitor_id"])})
            
            if not visitor or not visitor["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or inactive visitor"
                )
            
            # Determine target owners/flats
            is_all_flats = visitor.get("is_all_flats", False)
            valid_flats = visitor.get("valid_flats", [])
            
            target_flat_ids = []
            if is_all_flats:
                # Fetch all unique flat IDs from residents
                all_flats = await db.residents.distinct("flat_id")
                target_flat_ids = random.sample(all_flats, min(len(all_flats), 3)) if all_flats else []
            elif valid_flats:
                target_flat_ids = valid_flats
            else:
                target_flat_ids = [qr_request.owner_id]

            # Determine status based on auto-approval rules
            auto_approval = visitor.get("auto_approval", {})
            rule = auto_approval.get("rule", "always")
            
            status_val = "auto_approved"
            entry_time = datetime.utcnow()
            
            if rule == "manual":
                status_val = "pending"
                entry_time = None
            elif rule == "within_schedule":
                if not is_within_schedule(visitor.get("schedule", {})):
                    status_val = "pending"
                    entry_time = None
            
            visit_doc = {
                "visitor_id": str(visitor["_id"]),
                "name_snapshot": visitor["name"],
                "phone_snapshot": visitor.get("phone"),
                "photo_snapshot_url": visitor["photo_url"],
                "purpose": qr_request.purpose or visitor.get("default_purpose", "Visit"),
                "owner_id": target_flat_ids[0] if target_flat_ids else qr_request.owner_id,
                "target_flat_ids": target_flat_ids,
                "guard_id": current_user["user_id"],
                "entry_time": entry_time,
                "exit_time": None,
                "status": status_val,
                "qr_token": qr_request.qr_token,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        
        elif token_type == "temporary":
            temp_qr_collection = get_temporary_qr_collection()
            temp_qr = await temp_qr_collection.find_one({"_id": ObjectId(payload["temp_qr_id"])})
            
            if not temp_qr or temp_qr.get("used_at") or datetime.utcnow() > temp_qr["expires_at"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired temporary QR"
                )
            
            # Determine target owners/flats
            is_all_flats = temp_qr.get("is_all_flats", False)
            valid_flats = temp_qr.get("valid_flats", [])
            
            target_flat_ids = []
            if is_all_flats:
                all_flats = await db.residents.distinct("flat_id")
                target_flat_ids = random.sample(all_flats, min(len(all_flats), 3)) if all_flats else []
            elif valid_flats:
                target_flat_ids = valid_flats
            else:
                target_flat_ids = [temp_qr["owner_id"]]

            # Mark temp QR as used
            await temp_qr_collection.update_one(
                {"_id": ObjectId(payload["temp_qr_id"])},
                {"$set": {"used_at": datetime.utcnow()}}
            )
            
            visit_doc = {
                "visitor_id": None,
                "name_snapshot": temp_qr.get("guest_name", "Guest"),
                "phone_snapshot": None,
                "photo_snapshot_url": None,
                "purpose": "Guest visit",
                "owner_id": target_flat_ids[0] if target_flat_ids else temp_qr["owner_id"],
                "target_flat_ids": target_flat_ids,
                "guard_id": current_user["user_id"],
                "entry_time": datetime.utcnow(),
                "exit_time": None,
                "status": "auto_approved",
                "qr_token": qr_request.qr_token,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown QR type"
            )
        
        # Insert visit
        result = await visits.insert_one(visit_doc)
        
        # Send SSE notification based on status
        if visit_doc["status"] == "pending":
            await sse_manager.broadcast_to_flats(
                visit_doc["target_flat_ids"],
                "new_visit_pending",
                {
                    "visit_id": str(result.inserted_id),
                    "visitor_name": visit_doc["name_snapshot"],
                    "visitor_phone": visit_doc["phone_snapshot"],
                    "purpose": visit_doc["purpose"],
                    "photo_url": visit_doc["photo_snapshot_url"],
                    "guard_id": current_user["user_id"]
                },
                db
            )
            
            # Broadcast to guards for real-time dashboard update
            await sse_manager.broadcast_to_role(
                "guard",
                "new_visit_pending",
                {
                    "id": str(result.inserted_id),
                    "visitor_id": str(visitor["_id"]),
                    "name_snapshot": visit_doc["name_snapshot"],
                    "phone_snapshot": visit_doc["phone_snapshot"],
                    "photo_snapshot_url": visit_doc["photo_snapshot_url"],
                    "purpose": visit_doc["purpose"],
                    "owner_id": visit_doc["owner_id"],
                    "guard_id": visit_doc["guard_id"],
                    "entry_time": visit_doc["entry_time"].isoformat() if visit_doc["entry_time"] else None,
                    "exit_time": None,
                    "status": visit_doc["status"],
                    "qr_token": visit_doc["qr_token"],
                    "created_at": visit_doc["created_at"].isoformat()
                }
            )
        else:
            await sse_manager.broadcast_to_flats(
                visit_doc["target_flat_ids"],
                "visit_auto_approved",
                {
                    "visit_id": str(result.inserted_id),
                    "visitor_name": visit_doc["name_snapshot"],
                    "purpose": visit_doc["purpose"],
                    "entry_time": visit_doc["entry_time"].isoformat() if visit_doc["entry_time"] else None
                },
                db
            )
            
            # Broadcast to guards for real-time dashboard update
            await sse_manager.broadcast_to_role(
                "guard",
                "visit_auto_approved",
                {
                    "id": str(result.inserted_id),
                    "visitor_id": str(visitor["_id"]),
                    "name_snapshot": visit_doc["name_snapshot"],
                    "phone_snapshot": visit_doc["phone_snapshot"],
                    "photo_snapshot_url": visit_doc["photo_snapshot_url"],
                    "purpose": visit_doc["purpose"],
                    "owner_id": visit_doc["owner_id"],
                    "guard_id": visit_doc["guard_id"],
                    "entry_time": visit_doc["entry_time"].isoformat() if visit_doc["entry_time"] else None,
                    "exit_time": None,
                    "status": visit_doc["status"],
                    "qr_token": visit_doc["qr_token"],
                    "created_at": visit_doc["created_at"].isoformat()
                }
            )
    
    # Handle new visitor flow
    else:
        # Determine target owners/flats for New Visitor
        target_flat_ids = []
        if new_request.owner_id == "all":
            all_flats = await db.residents.distinct("flat_id")
            target_flat_ids = random.sample(all_flats, min(len(all_flats), 3)) if all_flats else []
        else:
            target_flat_ids = [new_request.owner_id]

        visit_doc = {
            "visitor_id": None,
            "name_snapshot": new_request.name,
            "phone_snapshot": new_request.phone,
            "photo_snapshot_url": new_request.photo_url,  # Local buffer path
            "purpose": new_request.purpose,
            "owner_id": target_flat_ids[0] if target_flat_ids else new_request.owner_id,
            "target_flat_ids": target_flat_ids,
            "guard_id": current_user["user_id"],
            "entry_time": None,  # Set after approval
            "exit_time": None,
            "status": "pending",
            "qr_token": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert visit
        result = await visits.insert_one(visit_doc)
        
        # Send SSE notification to all targeted flats for approval
        await sse_manager.broadcast_to_flats(
            target_flat_ids,
            "new_visit_pending",
            {
                "visit_id": str(result.inserted_id),
                "visitor_name": new_request.name,
                "visitor_phone": new_request.phone,
                "purpose": new_request.purpose,
                "photo_url": new_request.photo_url,
                "guard_id": current_user["user_id"]
            },
            db
        )
        
        # Broadcast to guards for real-time dashboard update
        await sse_manager.broadcast_to_role(
            "guard",
            "new_visit_pending",
            {
                "id": str(result.inserted_id),
                "visitor_id": None,
                "name_snapshot": visit_doc["name_snapshot"],
                "phone_snapshot": visit_doc["phone_snapshot"],
                "photo_snapshot_url": visit_doc["photo_snapshot_url"],
                "purpose": visit_doc["purpose"],
                "owner_id": visit_doc["owner_id"],
                "guard_id": visit_doc["guard_id"],
                "entry_time": None,
                "exit_time": None,
                "status": visit_doc["status"],
                "qr_token": None,
                "created_at": visit_doc["created_at"].isoformat()
            }
        )
    
    # Fetch and return created visit
    created_visit = await visits.find_one({"_id": result.inserted_id})
    
    return VisitResponse(
        id=str(created_visit["_id"]),
        visitor_id=created_visit.get("visitor_id"),
        name_snapshot=created_visit["name_snapshot"],
        phone_snapshot=created_visit.get("phone_snapshot"),
        photo_snapshot_url=created_visit["photo_snapshot_url"],
        purpose=created_visit["purpose"],
        owner_id=created_visit["owner_id"],
        guard_id=created_visit["guard_id"],
        entry_time=created_visit.get("entry_time"),
        exit_time=created_visit.get("exit_time"),
        status=created_visit["status"],
        qr_token=created_visit.get("qr_token"),
        created_at=created_visit["created_at"]
    )


@router.patch("/{visit_id}/approve", response_model=VisitResponse)
async def approve_visit(
    visit_id: str,
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Approve a pending visit
    
    Only the owner of the visit can approve it
    """
    visits = get_visits_collection()
    
    try:
        visit = await visits.find_one({"_id": ObjectId(visit_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visit ID"
        )
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )
    
    # Check ownership (match user_id OR flat_id OR target_flat_ids)
    is_owner = visit["owner_id"] == current_user["user_id"]
    
    # If not direct match, check flat_id
    if not is_owner:
        resident = await db.residents.find_one({"_id": ObjectId(current_user["user_id"])})
        if resident:
            flat_id = resident.get("flat_id")
            if flat_id == visit["owner_id"] or flat_id in visit.get("target_flat_ids", []):
                is_owner = True
            
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if visit["status"] != "pending":
        # Check if it's already approved to avoid error
        if visit["status"] == "approved":
            return VisitResponse(
                id=str(visit["_id"]),
                visitor_id=visit.get("visitor_id"),
                name_snapshot=visit["name_snapshot"],
                phone_snapshot=visit.get("phone_snapshot"),
                photo_snapshot_url=visit["photo_snapshot_url"],
                purpose=visit["purpose"],
                owner_id=visit["owner_id"],
                guard_id=visit["guard_id"],
                entry_time=visit.get("entry_time"),
                exit_time=visit.get("exit_time"),
                status=visit["status"],
                qr_token=visit.get("qr_token"),
                created_at=visit["created_at"]
            )
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Visit is {visit['status']}, cannot approve"
        )
    
    # Update visit
    await visits.update_one(
        {"_id": ObjectId(visit_id)},
        {
            "$set": {
                "status": "approved",
                "entry_time": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Send SSE notification to guard
    await sse_manager.send_event(
        visit["guard_id"],
        "visit_approved",
        {
            "visit_id": visit_id,
            "visitor_name": visit["name_snapshot"],
            "approved_at": datetime.utcnow().isoformat()
        }
    )
    
    # Fetch updated visit
    updated_visit = await visits.find_one({"_id": ObjectId(visit_id)})
    
    return VisitResponse(
        id=str(updated_visit["_id"]),
        visitor_id=updated_visit.get("visitor_id"),
        name_snapshot=updated_visit["name_snapshot"],
        phone_snapshot=updated_visit.get("phone_snapshot"),
        photo_snapshot_url=updated_visit["photo_snapshot_url"],
        purpose=updated_visit["purpose"],
        owner_id=updated_visit["owner_id"],
        guard_id=updated_visit["guard_id"],
        entry_time=updated_visit.get("entry_time"),
        exit_time=updated_visit.get("exit_time"),
        status=updated_visit["status"],
        qr_token=updated_visit.get("qr_token"),
        created_at=updated_visit["created_at"]
    )


@router.patch("/{visit_id}/reject", response_model=VisitResponse)
async def reject_visit(
    visit_id: str,
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Reject a pending visit
    
    Only the owner of the visit can reject it
    """
    visits = get_visits_collection()
    
    try:
        visit = await visits.find_one({"_id": ObjectId(visit_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visit ID"
        )
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )
    
    # Check ownership (match user_id OR flat_id)
    is_owner = visit["owner_id"] == current_user["user_id"]
    
    # If not direct match, check flat_id
    if not is_owner:
        resident = await db.residents.find_one({"_id": ObjectId(current_user["user_id"])})
        if resident and resident.get("flat_id") == visit["owner_id"]:
            is_owner = True
            
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if visit["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Visit is {visit['status']}, cannot reject"
        )
    
    # Update visit
    await visits.update_one(
        {"_id": ObjectId(visit_id)},
        {
            "$set": {
                "status": "rejected",
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Send SSE notification to guard
    await sse_manager.send_event(
        visit["guard_id"],
        "visit_rejected",
        {
            "visit_id": visit_id,
            "visitor_name": visit["name_snapshot"],
            "rejected_at": datetime.utcnow().isoformat()
        }
    )
    
    # Fetch updated visit
    updated_visit = await visits.find_one({"_id": ObjectId(visit_id)})
    
    return VisitResponse(
        id=str(updated_visit["_id"]),
        visitor_id=updated_visit.get("visitor_id"),
        name_snapshot=updated_visit["name_snapshot"],
        phone_snapshot=updated_visit.get("phone_snapshot"),
        photo_snapshot_url=updated_visit["photo_snapshot_url"],
        purpose=updated_visit["purpose"],
        owner_id=updated_visit["owner_id"],
        guard_id=updated_visit["guard_id"],
        entry_time=updated_visit.get("entry_time"),
        exit_time=updated_visit.get("exit_time"),
        status=updated_visit["status"],
        qr_token=updated_visit.get("qr_token"),
        created_at=updated_visit["created_at"]
    )


@router.get("/today", response_model=List[VisitResponse])
async def get_todays_visits(
    guard_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get today's visits
    
    - Guards see visits they created
    - Owners see visits for their property
    - Admins can filter by guard_id or owner_id
    """
    visits = get_visits_collection()
    
    # Build query for today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = {"created_at": {"$gte": today_start}}
    
    # Apply filters based on role
    if current_user["role"] == "guard":
        query["guard_id"] = current_user["user_id"]
    elif current_user["role"] == "owner":
        query["owner_id"] = current_user["user_id"]
    elif guard_id:
        query["guard_id"] = guard_id
    elif owner_id:
        query["owner_id"] = owner_id
    
    # Fetch visits
    cursor = visits.find(query).sort("created_at", -1)
    visit_list = await cursor.to_list(length=200)
    
    return [
        VisitResponse(
            id=str(v["_id"]),
            visitor_id=v.get("visitor_id"),
            name_snapshot=v["name_snapshot"],
            phone_snapshot=v.get("phone_snapshot"),
            photo_snapshot_url=v["photo_snapshot_url"],
            purpose=v["purpose"],
            owner_id=v["owner_id"],
            guard_id=v["guard_id"],
            entry_time=v.get("entry_time"),
            exit_time=v.get("exit_time"),
            status=v["status"],
            qr_token=v.get("qr_token"),
            is_all_flats=v.get("is_all_flats", False),
            valid_flats=v.get("valid_flats"),
            target_flat_ids=v.get("target_flat_ids"),
            created_at=v["created_at"]
        )
        for v in visit_list
    ]


@router.patch("/{visit_id}/checkout", response_model=VisitResponse)
async def checkout_visit(
    visit_id: str,
    current_user: dict = Depends(get_current_guard)
):
    """
    Checkout a visit (set exit time)
    
    Guards can checkout any visit
    """
    visits = get_visits_collection()
    
    try:
        visit = await visits.find_one({"_id": ObjectId(visit_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visit ID"
        )
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )
    
    if visit.get("exit_time"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Visit already checked out"
        )
    
    # Update visit
    await visits.update_one(
        {"_id": ObjectId(visit_id)},
        {
            "$set": {
                "exit_time": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Fetch updated visit
    updated_visit = await visits.find_one({"_id": ObjectId(visit_id)})
    
    return VisitResponse(
        id=str(updated_visit["_id"]),
        visitor_id=updated_visit.get("visitor_id"),
        name_snapshot=updated_visit["name_snapshot"],
        phone_snapshot=updated_visit.get("phone_snapshot"),
        photo_snapshot_url=updated_visit["photo_snapshot_url"],
        purpose=updated_visit["purpose"],
        owner_id=updated_visit["owner_id"],
        guard_id=updated_visit["guard_id"],
        entry_time=updated_visit.get("entry_time"),
        exit_time=updated_visit.get("exit_time"),
        status=updated_visit["status"],
        qr_token=updated_visit.get("qr_token"),
        created_at=updated_visit["created_at"]
    )


@router.delete("/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visit(
    visit_id: str,
    current_user: dict = Depends(get_current_guard)
):
    """
    Delete/Cancel a pending visit request
    
    Only the guard who created it can delete it, and only if it's still pending
    """
    visits = get_visits_collection()
    
    try:
        visit = await visits.find_one({"_id": ObjectId(visit_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visit ID"
        )
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )
    
    # Check ownership (guard who created it)
    if visit["guard_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the creator can cancel this request."
        )
    
    if visit["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a visit that is not pending"
        )
    
    # Delete visit
    await visits.delete_one({"_id": ObjectId(visit_id)})
    
    # Notify owner that request was cancelled (optional, but good UX)
    # We can use a new event type or just let the pending list update
    await sse_manager.send_event(
        visit["owner_id"],
        "visit_cancelled",
        {
            "visit_id": visit_id,
            "visitor_name": visit["name_snapshot"]
        }
    )
    
    return None


# ===== GET ENDPOINTS FOR HORIZON DASHBOARD =====

@router.get("/notifications", response_model=List[dict])
async def get_notifications(
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get notifications for the current owner based on recent activity
    """
    try:
        visits_collection = get_visits_collection()
        
        # Get owner's flat_id
        user_id = current_user.get("user_id")
        resident = await db.residents.find_one({"_id": ObjectId(user_id)})
        if not resident:
            return []
            
        flat_id = resident.get("flat_id")
        if not flat_id:
            return []
            
        # Fetch recent visits (last 50) where specifically for this flat or broadcast to this flat
        cursor = visits_collection.find({
            "$or": [
                {"owner_id": flat_id},
                {"target_flat_ids": flat_id}
            ],
            "status": {"$in": ["approved", "rejected", "auto_approved"]}
        }).sort("updated_at", -1).limit(50)
        
        visits = await cursor.to_list(length=50)
        
        notifications = []
        for visit in visits:
            # Determine type and message based on status
            notif_type = "general"
            title = "Visit Update"
            message = f"Update for {visit['name_snapshot']}"
            
            if visit["status"] == "approved":
                notif_type = "approval"
                title = "Visitor Approved"
                message = f"{visit['name_snapshot']} has been approved for entry."
            elif visit["status"] == "rejected":
                notif_type = "rejection"
                title = "Visitor Rejected"
                message = f"Entry denied for {visit['name_snapshot']}."
            elif visit["status"] == "auto_approved":
                notif_type = "qr"
                title = "QR Code Used"
                message = f"{visit['name_snapshot']} entered using QR code."
                
            # Calculate relative time
            updated_at = visit.get("updated_at", visit["created_at"])
            diff = datetime.utcnow() - updated_at
            
            if diff.days > 0:
                timestamp = f"{diff.days}d ago"
            elif diff.seconds >= 3600:
                timestamp = f"{diff.seconds // 3600}h ago"
            elif diff.seconds >= 60:
                timestamp = f"{diff.seconds // 60}m ago"
            else:
                timestamp = "Just now"
                
            is_broadcast = visit.get("is_all_flats") or (visit.get("target_flat_ids") and len(visit["target_flat_ids"]) > 1)
                
            notifications.append({
                "id": str(visit["_id"]),
                "type": notif_type,
                "title": title,
                "message": message,
                "timestamp": timestamp,
                "read": True, # For now, mark all as read since we don't track read status
                "is_broadcast": is_broadcast
            })
            
        return notifications
        
    except Exception as e:
        print(f"[ERROR] Failed to get notifications: {str(e)}")
        return []


@router.get("/pending", response_model=List[VisitResponse])
async def get_pending_visits(
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get all pending visits for the current owner
    Used by Horizon approvals page
    """
    try:
        visits_collection = get_visits_collection()
        
        # Log current user for debugging
        print(f"[DEBUG] Current user: {current_user}")
        
        # Look up owner's flat_id from database (JWT doesn't have it)
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id missing from JWT"
            )
        
        print(f"[DEBUG] Looking up resident with _id: {user_id}")
        resident = await db.residents.find_one({"_id": ObjectId(user_id)})
        print(f"[DEBUG] Resident found: {resident}")
        
        if not resident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Owner not found with user_id: {user_id}"
            )
        
        flat_id = resident.get("flat_id")
        if not flat_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Owner {resident.get('name')} missing flat_id"
            )
        
        print(f"[DEBUG] Querying visits for flat_id: {flat_id}")
        visits = await visits_collection.find({
            "$or": [
                {"owner_id": flat_id},
                {"target_flat_ids": flat_id}
            ],
            "status": "pending"
        }).sort("created_at", -1).to_list(length=100)
        
        print(f"[DEBUG] Found {len(visits)} pending visits")
        
        return [
            VisitResponse(
                id=str(visit["_id"]),
                visitor_id=visit.get("visitor_id"),
                name_snapshot=visit["name_snapshot"],
                phone_snapshot=visit.get("phone_snapshot"),
                photo_snapshot_url=visit["photo_snapshot_url"],
                purpose=visit["purpose"],
                owner_id=visit["owner_id"],
                guard_id=visit["guard_id"],
                entry_time=visit.get("entry_time"),
                exit_time=visit.get("exit_time"),
                status=visit["status"],
                qr_token=visit.get("qr_token"),  # None for pending visits
                created_at=visit["created_at"]
            )
        for visit in visits
    ]
    except Exception as e:
        print(f"[ERROR] Failed to get pending visits: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pending visits: {str(e)}"
        )



async def get_owner_flat_id(user_id: str, db) -> str:
    """Helper to get flat_id for an owner"""
    resident = await db.residents.find_one({"_id": ObjectId(user_id)})
    if not resident or not resident.get("flat_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner not found or missing flat_id"
        )
    return resident["flat_id"]


async def enrich_visit_with_guard_info(visit: dict, db) -> dict:
    """Add guard name to visit data for timeline view"""
    if visit.get("guard_id"):
        try:
            guard = await db.users.find_one({"_id": ObjectId(visit["guard_id"])})
            visit["guard_name"] = guard.get("name", "Unknown Guard") if guard else "Unknown Guard"
        except Exception:
            visit["guard_name"] = "Unknown Guard"
    else:
        visit["guard_name"] = "Unknown Guard"
    return visit



@router.get("/pending/count")
async def get_pending_count(
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get count of pending visits for the current owner
    Used by Horizon dashboard stats
    """
    visits_collection = get_visits_collection()
    flat_id = await get_owner_flat_id(current_user["user_id"], db)
    
    count = await visits_collection.count_documents({
        "$or": [
            {"owner_id": flat_id},
            {"target_flat_ids": flat_id}
        ],
        "status": "pending"
    })
    
    return {"count": count}


@router.get("/today/count")
async def get_today_count(
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get count of today's visits for the current owner
    Used by Horizon dashboard stats
    """
    visits_collection = get_visits_collection()
    flat_id = await get_owner_flat_id(current_user["user_id"], db)
    
    # Get start of today (midnight)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    count = await visits_collection.count_documents({
        "$or": [
            {"owner_id": flat_id},
            {"target_flat_ids": flat_id}
        ],
        "created_at": {"$gte": today_start}
    })
    
    return {"count": count}


@router.get("/recent", response_model=List[VisitResponse])
async def get_recent_visits(
    limit: int = 10,
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get recent visits for the current owner
    Used by Horizon dashboard recent activity
    """
    visits_collection = get_visits_collection()
    flat_id = await get_owner_flat_id(current_user["user_id"], db)
    
    visits = await visits_collection.find({
        "$or": [
            {"owner_id": flat_id},
            {"target_flat_ids": flat_id}
        ]
    }).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    return [
        VisitResponse(
            id=str(visit["_id"]),
            visitor_id=visit.get("visitor_id"),
            name_snapshot=visit["name_snapshot"],
            phone_snapshot=visit.get("phone_snapshot"),
            photo_snapshot_url=visit["photo_snapshot_url"],
            purpose=visit["purpose"],
            owner_id=visit["owner_id"],
            guard_id=visit["guard_id"],
            entry_time=visit.get("entry_time"),
            exit_time=visit.get("exit_time"),
            status=visit["status"],
            qr_token=visit.get("qr_token"),
            is_all_flats=visit.get("is_all_flats", False),
            valid_flats=visit.get("valid_flats"),
            target_flat_ids=visit.get("target_flat_ids"),
            created_at=visit["created_at"]
        )
        for visit in visits
    ]


@router.get("/stats/summary")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get summary statistics for the dashboard
    Returns counts for Today, Pending, Approved Today, and Active QR
    """
    visits_collection = get_visits_collection()
    temp_qr_collection = get_temporary_qr_collection()
    flat_id = await get_owner_flat_id(current_user["user_id"], db)
    
    query_target = {
        "$or": [
            {"owner_id": flat_id},
            {"target_flat_ids": flat_id}
        ]
    }
    
    # Time ranges
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    now = datetime.utcnow()
    
    # 1. Today's Visitors (Created today)
    today_count = await visits_collection.count_documents({
        **query_target,
        "created_at": {"$gte": today_start}
    })
    
    # 2. Pending Approvals
    pending_count = await visits_collection.count_documents({
        **query_target,
        "status": "pending"
    })
    
    # 3. Approved Today (Status approved/auto_approved and created today)
    approved_count = await visits_collection.count_documents({
        **query_target,
        "status": {"$in": ["approved", "auto_approved"]},
        "created_at": {"$gte": today_start}
    })
    
    # 4. Active QR Codes (Temporary QRs that are valid and not used)
    active_qr_count = await temp_qr_collection.count_documents({
        "owner_id": flat_id,
        "expires_at": {"$gt": now},
        "used_at": None
    })
    
    return {
        "today_count": today_count,
        "pending_count": pending_count,
        "approved_count": approved_count,
        "active_qr_count": active_qr_count
    }


@router.get("/stats/weekly")
async def get_weekly_stats(
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get weekly visitor statistics for the current owner
    Used by Horizon dashboard weekly activity chart
    Returns visitor counts for the last 7 days
    """
    visits_collection = get_visits_collection()
    flat_id = await get_owner_flat_id(current_user["user_id"], db)
    
    # Get last 7 days
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=6)
    
    # Aggregate by day
    pipeline = [
        {
            "$match": {
                "owner_id": str(current_user["user_id"]),
                "created_at": {"$gte": week_ago}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at"
                    }
                },
                "count": {"$sum": 1}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]
    
    results = await visits_collection.aggregate(pipeline).to_list(length=7)
    
    # Create a map of date -> count
    counts_by_date = {result["_id"]: result["count"] for result in results}
    
    # Fill in missing days with 0
    weekly_data = []
    for i in range(7):
        date = week_ago + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        day_name = date.strftime("%a")  # Mon, Tue, etc.
        
        weekly_data.append({
            "day": day_name,
            "date": date_str,
            "count": counts_by_date.get(date_str, 0)
        })
    
    return {"weekly_stats": weekly_data}


@router.get("/{visit_id}")
async def get_visit_details(
    visit_id: str,
    current_user: dict = Depends(get_current_owner),
    db = Depends(get_database)
):
    """
    Get detailed information for a single visit including guard name
    Used by Horizon visitor timeline view
    """
    visits_collection = get_visits_collection()
    flat_id = await get_owner_flat_id(current_user["user_id"], db)
    
    try:
        visit = await visits_collection.find_one({"_id": ObjectId(visit_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visit ID"
        )
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )
    
    # Verify ownership
    if visit["owner_id"] != flat_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Enrich with guard name
    visit = await enrich_visit_with_guard_info(visit, db)
    
    return {
        "id": str(visit["_id"]),
        "visitor_id": visit.get("visitor_id"),
        "name_snapshot": visit["name_snapshot"],
        "phone_snapshot": visit.get("phone_snapshot"),
        "photo_snapshot_url": visit["photo_snapshot_url"],
        "purpose": visit["purpose"],
        "owner_id": visit["owner_id"],
        "guard_id": visit["guard_id"],
        "guard_name": visit.get("guard_name", "Unknown Guard"),
        "entry_time": visit.get("entry_time").isoformat() if visit.get("entry_time") else None,
        "exit_time": visit.get("exit_time").isoformat() if visit.get("exit_time") else None,
        "status": visit["status"],
        "qr_token": visit.get("qr_token"),
        "created_at": visit["created_at"].isoformat(),
        "updated_at": visit.get("updated_at").isoformat() if visit.get("updated_at") else visit["created_at"].isoformat()
    }



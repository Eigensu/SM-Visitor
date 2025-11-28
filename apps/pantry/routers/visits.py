"""
Visit Lifecycle Router - Handle QR scanning, visit creation, approval/rejection, and checkout
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId

from database import get_visits_collection, get_visitors_collection, get_temporary_qr_collection
from middleware.auth import get_current_guard, get_current_owner, get_current_user
from utils.jwt_utils import decode_qr_token
from utils.qr_utils import parse_qr_data
from utils.sse_manager import sse_manager


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
    _id: str
    visitor_id: Optional[str]
    name_snapshot: str
    phone_snapshot: Optional[str]
    photo_snapshot_url: str
    purpose: str
    owner_id: str
    guard_id: str
    entry_time: Optional[datetime]
    exit_time: Optional[datetime]
    status: str
    qr_token: Optional[str]
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
        
        return QRScanResponse(
            valid=True,
            auto_approve=True,
            visitor_data={
                "visitor_id": str(visitor["_id"]),
                "name": visitor["name"],
                "phone": visitor.get("phone"),
                "photo_url": visitor["photo_url"],
                "purpose": visitor.get("default_purpose", "Visit"),
                "visitor_type": "regular"
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
    qr_request: Optional[StartVisitQRRequest] = None,
    new_request: Optional[StartVisitNewRequest] = None,
    current_user: dict = Depends(get_current_guard)
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
            
            visit_doc = {
                "visitor_id": str(visitor["_id"]),
                "name_snapshot": visitor["name"],
                "phone_snapshot": visitor.get("phone"),
                "photo_snapshot_url": visitor["photo_url"],
                "purpose": qr_request.purpose or visitor.get("default_purpose", "Visit"),
                "owner_id": qr_request.owner_id,
                "guard_id": current_user["user_id"],
                "entry_time": datetime.utcnow(),
                "exit_time": None,
                "status": "auto_approved",
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
            
            # Mark temp QR as used
            await temp_qr_collection.update_one(
                {"_id": ObjectId(payload["temp_qr_id"])},
                {"$set": {"used_at": datetime.utcnow()}}
            )
            
            visit_doc = {
                "visitor_id": None,
                "name_snapshot": temp_qr.get("guest_name", "Guest"),
                "phone_snapshot": None,
                "photo_snapshot_url": None,  # No photo for temp QR
                "purpose": "Guest visit",
                "owner_id": temp_qr["owner_id"],
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
        
        # Send SSE notification to owner
        await sse_manager.send_event(
            visit_doc["owner_id"],
            "visit_auto_approved",
            {
                "visit_id": str(result.inserted_id),
                "visitor_name": visit_doc["name_snapshot"],
                "purpose": visit_doc["purpose"],
                "entry_time": visit_doc["entry_time"].isoformat()
            }
        )
    
    # Handle new visitor flow
    else:
        visit_doc = {
            "visitor_id": None,
            "name_snapshot": new_request.name,
            "phone_snapshot": new_request.phone,
            "photo_snapshot_url": new_request.photo_url,  # Local buffer path
            "purpose": new_request.purpose,
            "owner_id": new_request.owner_id,
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
        
        # Send SSE notification to owner for approval
        await sse_manager.send_event(
            new_request.owner_id,
            "new_visit_pending",
            {
                "visit_id": str(result.inserted_id),
                "visitor_name": new_request.name,
                "visitor_phone": new_request.phone,
                "purpose": new_request.purpose,
                "photo_url": new_request.photo_url,
                "guard_id": current_user["user_id"]
            }
        )
    
    # Fetch and return created visit
    created_visit = await visits.find_one({"_id": result.inserted_id})
    
    return VisitResponse(
        _id=str(created_visit["_id"]),
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
    current_user: dict = Depends(get_current_owner)
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
    
    # Check ownership
    if visit["owner_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if visit["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Visit is not pending"
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
        _id=str(updated_visit["_id"]),
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
    current_user: dict = Depends(get_current_owner)
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
    
    # Check ownership
    if visit["owner_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if visit["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Visit is not pending"
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
        _id=str(updated_visit["_id"]),
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
            _id=str(v["_id"]),
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
        _id=str(updated_visit["_id"]),
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

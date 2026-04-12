from enum import Enum
from typing import Any, Optional
from datetime import datetime

class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

def serialize_visitor(visitor: dict) -> dict:
    """
    Deterministic visitor serialization to prevent contract drift.
    Ensures mandatory fields for both standard and QR-enhanced responses.
    """
    # 1. Fallback for legacy records or incomplete data
    if "approval_status" not in visitor:
        visitor["approval_status"] = ApprovalStatus.APPROVED if visitor.get("is_active") else ApprovalStatus.PENDING
    
    # 2. Normalize status to uppercase enum
    status = visitor["approval_status"]
    if isinstance(status, str):
        status = status.upper()
    
    # 3. Construct response object following strict contract
    # Backfill missing role (Production Hardening)
    created_by_role = visitor.get("created_by_role")
    if not created_by_role:
        # If it was created by an owner previously, we can try to infer it, 
        # but defaulting to 'guard' for legacy registrations is safer for UI logic.
        created_by_role = "guard"

    return {
        "_id": str(visitor["_id"]),
        "name": visitor.get("name"),
        "phone": visitor.get("phone"),
        "photo_url": visitor.get("photo_url"),
        "visitor_type": visitor.get("visitor_type", "new"),
        "created_by": str(visitor.get("created_by")),
        "created_by_role": created_by_role,
        "default_purpose": visitor.get("default_purpose"),
        "qr_token": visitor.get("qr_token"),
        "is_active": visitor.get("is_active", True),
        "approval_status": str(visitor.get("approval_status", "approved")).upper(),
        "assigned_owner_id": str(visitor.get("assigned_owner_id")) if visitor.get("assigned_owner_id") else None,
        "created_at": visitor.get("created_at")
    }

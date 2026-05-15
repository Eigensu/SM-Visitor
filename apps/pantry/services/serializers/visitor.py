from enum import Enum


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


def serialize_visitor(visitor: dict) -> dict:
    """
    Deterministic visitor serialization to prevent contract drift.
    Ensures mandatory fields for both standard and QR-enhanced responses.
    """
    # 1. Fallback for legacy records or incomplete data
    if "approval_status" not in visitor:
        visitor["approval_status"] = (
            ApprovalStatus.APPROVED
            if visitor.get("is_active")
            else ApprovalStatus.PENDING
        )

    # 2. Normalize status to lowercase enum or string value
    status = visitor["approval_status"]
    if isinstance(status, Enum):
        normalized_status = str(status.value).lower()
    elif isinstance(status, str):
        normalized_status = status.lower()
    else:
        normalized_status = str(status).lower() if status is not None else "approved"

    # 3. Construct response object following strict contract
    # Backfill missing role (Production Hardening)
    created_by_role = visitor.get("created_by_role")
    if not created_by_role:
        # If it was created by an owner previously, we can try to infer it,
        # but defaulting to 'guard' for legacy registrations is safer for UI logic.
        created_by_role = "guard"

    # 4. Computed Fields & Hardening
    expires_at = visitor.get("qr_expires_at")

    return {
        "id": str(
            visitor["_id"]
        ),  # 'id' matches VisitorResponse field + frontend req.id
        "name": visitor.get("name"),
        "phone": visitor.get("phone"),
        "photo_url": visitor.get("photo_url"),
        "visitor_type": visitor.get("visitor_type", "new"),
        "created_by": str(visitor.get("created_by")),
        "created_by_role": created_by_role,
        "default_purpose": visitor.get("default_purpose"),
        "qr_token": visitor.get("qr_token"),
        "qr_validity_hours": visitor.get("qr_validity_hours"),
        "qr_expires_at": (
            expires_at.isoformat()
            if expires_at and hasattr(expires_at, "isoformat")
            else expires_at
        ),
        "pass_type": "temporary" if visitor.get("qr_validity_hours") else "permanent",
        "is_active": visitor.get("is_active", True),
        "approval_status": normalized_status,
        "assigned_owner_id": (
            str(visitor.get("assigned_owner_id"))
            if visitor.get("assigned_owner_id")
            else None
        ),
        "flat_id": visitor.get("flat_id"),
        "category": visitor.get("category"),
        "category_label": visitor.get("category_label"),
        "created_at": visitor.get("created_at"),
    }

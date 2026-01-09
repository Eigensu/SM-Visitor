"""
Users Router
Handles user-related operations
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from database import get_database
from routers.auth import UserResponse, get_current_user, require_role, require_guard

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=List[UserResponse])
async def list_users(
    role: Optional[str] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    List users, optionally filtered by role.
    Requires authentication.
    """
    query = {}
    if role:
        query["role"] = role
        
    cursor = db.users.find(query)
    users = await cursor.to_list(length=100)
    
    return [
        {
            "_id": str(user["_id"]),
            "name": user["name"],
            "phone": user["phone"],
            "role": user["role"],
            "flat_id": user.get("flat_id"),
            "created_at": user["created_at"]
        }
        for user in users
    ]

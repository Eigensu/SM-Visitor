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
    users = []
    
    if role == "owner":
        # Query residents collection
        cursor = db.residents.find({})
        users = await cursor.to_list(length=100)
    elif role == "guard":
        # Query guards collection
        cursor = db.guards.find({})
        users = await cursor.to_list(length=100)
    elif role == "admin":
        # Query users collection
        cursor = db.users.find({})
        users = await cursor.to_list(length=100)
    else:
        # No role filter - get from all collections
        residents_cursor = db.residents.find({})
        guards_cursor = db.guards.find({})
        admins_cursor = db.users.find({})
        
        residents = await residents_cursor.to_list(length=100)
        guards = await guards_cursor.to_list(length=100)
        admins = await admins_cursor.to_list(length=100)
        
        users = residents + guards + admins
    
    return [
        {
            "_id": str(user["_id"]),
            "name": user["name"],
            "phone": user["phone"],
            "role": user.get("role", "owner" if "flat_id" in user else "guard"),  # Infer role if missing
            "flat_id": user.get("flat_id"),
            "created_at": user["created_at"]
        }
        for user in users
    ]

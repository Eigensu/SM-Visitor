from typing import Optional
from database import get_database
from bson import ObjectId

async def get_owner_by_flat(flat_id: str) -> Optional[dict]:
    """
    Get the primary owner for a specific flat ID.
    Used for safe identity resolution at the API boundary, instead of
    trusting the frontend-provided owner IDs.
    """
    db = get_database()
    return await db.residents.find_one({
        "flat_id": flat_id,
        "role": "owner"
    })

async def get_user_by_id(user_id: str) -> Optional[dict]:
    """
    Get a user across any role by their canonical database ID.
    """
    db = get_database()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        return None
        
    # Try owner
    user = await db.residents.find_one({"_id": obj_id})
    if user:
        return user
        
    # Try guard
    user = await db.guards.find_one({"_id": obj_id})
    if user:
        return user
        
    # Try admin
    user = await db.users.find_one({"_id": obj_id})
    return user

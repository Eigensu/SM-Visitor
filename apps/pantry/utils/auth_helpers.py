"""
Auth Helpers for consistent identity resolution across the Pantry backend
"""
from typing import Dict, Any, Union
from bson import ObjectId

def get_user_id(user_context: Dict[str, Any]) -> str:
    """
    Standardizes user identifier resolution from JWT payload or DB document.
    Ensures we always get a string ID regardless of whether the source key 
    is 'user_id', 'id', or '_id'.
    """
    # 1. Check for 'user_id' (Standard in JWT payload)
    if "user_id" in user_context:
        return str(user_context["user_id"])
    
    # 2. Check for '_id' (Standard in MongoDB documents)
    if "_id" in user_context:
        return str(user_context["_id"])
    
    # 3. Check for 'id' (Common frontend/serialized key)
    if "id" in user_context:
        return str(user_context["id"])
    
    return ""

def normalize_id(id_val: Union[str, ObjectId]) -> str:
    """Consistently converts any ID type to string"""
    return str(id_val) if id_val else ""

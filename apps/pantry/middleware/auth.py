"""
Authentication middleware for protecting routes and extracting user context
"""
from fastapi import Header, HTTPException, status
from typing import Optional, Dict, Any
from utils.jwt_utils import decode_access_token


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from JWT token
    
    Args:
        authorization: Authorization header with Bearer token
    
    Returns:
        User payload from JWT
    
    Raises:
        HTTPException: If token is missing or invalid
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = parts[1]
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload


async def require_role(user: Dict[str, Any], allowed_roles: list[str]):
    """
    Check if user has required role
    
    Args:
        user: User payload from JWT
        allowed_roles: List of allowed roles
    
    Raises:
        HTTPException: If user doesn't have required role
    """
    if user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
        )


async def get_current_owner(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Dependency to get current owner user
    """
    user = await get_current_user(authorization)
    await require_role(user, ["owner", "admin"])
    return user


async def get_current_guard(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Dependency to get current guard user
    """
    user = await get_current_user(authorization)
    await require_role(user, ["guard", "admin"])
    return user


async def get_current_admin(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Dependency to get current admin user
    """
    user = await get_current_user(authorization)
    await require_role(user, ["admin"])
    return user

"""
Utility functions for JWT token generation and validation
"""
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS


def create_access_token(data: Dict[str, Any]) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Dictionary containing user_id, role, and optional flat_id
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload dictionary or None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def create_qr_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token for QR codes
    
    Args:
        data: Dictionary containing token data (visitor_id, type, etc.)
        expires_delta: Optional expiration time delta (None for no expiry)
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    to_encode.update({"iat": datetime.utcnow()})
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
        to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_qr_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a QR JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload dictionary or None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

"""
Unit tests for JWT utilities
"""
import pytest
from datetime import timedelta
from utils.jwt_utils import create_access_token, decode_access_token, create_qr_token, decode_qr_token


def test_create_access_token():
    """Test JWT access token creation"""
    payload = {
        "user_id": "test_user_123",
        "role": "owner"
    }
    
    token = create_access_token(payload)
    
    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0


def test_decode_access_token():
    """Test JWT access token decoding"""
    payload = {
        "user_id": "test_user_123",
        "role": "owner"
    }
    
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    
    assert decoded is not None
    assert decoded["user_id"] == "test_user_123"
    assert decoded["role"] == "owner"


def test_decode_invalid_token():
    """Test decoding invalid token"""
    decoded = decode_access_token("invalid_token_string")
    
    assert decoded is None


def test_create_qr_token():
    """Test QR token creation"""
    payload = {
        "type": "regular",
        "visitor_id": "visitor_123"
    }
    
    token = create_qr_token(payload)
    
    assert token is not None
    assert isinstance(token, str)


def test_decode_qr_token():
    """Test QR token decoding"""
    payload = {
        "type": "regular",
        "visitor_id": "visitor_123"
    }
    
    token = create_qr_token(payload)
    decoded = decode_qr_token(token)
    
    assert decoded is not None
    assert decoded["type"] == "regular"
    assert decoded["visitor_id"] == "visitor_123"


def test_qr_token_with_expiry():
    """Test QR token with expiry"""
    payload = {
        "type": "temporary",
        "temp_qr_id": "temp_123"
    }
    
    token = create_qr_token(payload, expires_delta=timedelta(hours=1))
    decoded = decode_qr_token(token)
    
    assert decoded is not None
    assert "exp" in decoded

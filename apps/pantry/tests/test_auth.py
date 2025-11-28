"""
Unit tests for authentication endpoints
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_request_otp(client: AsyncClient):
    """Test OTP login request"""
    response = await client.post(
        "/auth/login",
        json={"phone": "1234567890"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "OTP sent" in data["message"]


@pytest.mark.asyncio
async def test_login_invalid_phone(client: AsyncClient):
    """Test login with invalid phone number"""
    response = await client.post(
        "/auth/login",
        json={"phone": "123"}  # Too short
    )
    
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_verify_otp_invalid(client: AsyncClient):
    """Test OTP verification with invalid OTP"""
    # First request OTP
    await client.post("/auth/login", json={"phone": "1234567890"})
    
    # Try to verify with wrong OTP
    response = await client.post(
        "/auth/verify",
        json={"phone": "1234567890", "otp": "000000"}
    )
    
    assert response.status_code == 401
    assert "Invalid OTP" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_no_request(client: AsyncClient):
    """Test OTP verification without requesting OTP first"""
    response = await client.post(
        "/auth/verify",
        json={"phone": "9999999999", "otp": "123456"}
    )
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_current_user_without_auth(client: AsyncClient):
    """Test /auth/me without authentication"""
    response = await client.get("/auth/me")
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_with_invalid_token(client: AsyncClient):
    """Test /auth/me with invalid token"""
    response = await client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token"}
    )
    
    assert response.status_code == 401

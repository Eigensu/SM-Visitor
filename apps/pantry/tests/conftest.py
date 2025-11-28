"""
Test configuration and fixtures
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
from main import app
from database import get_database
from config import MONGODB_URI, DATABASE_NAME


# Test database name
TEST_DATABASE_NAME = f"{DATABASE_NAME}_test"


@pytest_asyncio.fixture
async def client():
    """
    Create test client for API requests
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def test_db():
    """
    Create test database and clean up after tests
    """
    # Connect to test database
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TEST_DATABASE_NAME]
    
    yield db
    
    # Cleanup: drop test database
    await client.drop_database(TEST_DATABASE_NAME)
    client.close()


@pytest_asyncio.fixture
async def auth_headers(client):
    """
    Get authentication headers for testing protected endpoints
    """
    # Create test user and get token
    phone = "1234567890"
    
    # Request OTP
    await client.post("/auth/login", json={"phone": phone})
    
    # Verify with fixed OTP for testing
    response = await client.post(
        "/auth/verify",
        json={"phone": phone, "otp": "123456"}  # Mock OTP
    )
    
    if response.status_code == 200:
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    return {}


@pytest.fixture
def sample_visitor_data():
    """
    Sample visitor data for testing
    """
    return {
        "name": "John Doe",
        "phone": "9876543210",
        "default_purpose": "Delivery"
    }


@pytest.fixture
def sample_visit_data():
    """
    Sample visit data for testing
    """
    return {
        "name": "Jane Smith",
        "phone": "5551234567",
        "purpose": "Guest visit",
        "owner_id": "test_owner_id"
    }

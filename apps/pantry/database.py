"""
Database configuration and connection management using Motor (async MongoDB driver)
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection settings
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")

# Global database client
_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo():
    """
    Establish connection to MongoDB
    """
    global _client, _database
    
    try:
        _client = AsyncIOMotorClient(MONGODB_URI)
        _database = _client[DATABASE_NAME]
        
        # Test connection
        await _client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {DATABASE_NAME}")
        
        # Create indexes
        await create_indexes()
        
    except Exception as e:
        print(f"[X] Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """
    Close MongoDB connection
    """
    global _client
    
    if _client:
        _client.close()
        print("🔌 Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """
    Get database instance
    """
    if _database is None:
        raise Exception("Database not initialized. Call connect_to_mongo() first.")
    return _database


async def create_indexes():
    """
    Create database indexes for optimal query performance
    """
    db = get_database()
    
    # Users collection indexes
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("flat_id")
    
    # Visitors collection indexes
    await db.visitors.create_index("phone")
    await db.visitors.create_index("created_by")
    await db.visitors.create_index("qr_token", unique=True, sparse=True)
    await db.visitors.create_index("is_active")
    
    # Visits collection indexes
    await db.visits.create_index("visitor_id")
    await db.visits.create_index("owner_id")
    await db.visits.create_index("guard_id")
    await db.visits.create_index("status")
    await db.visits.create_index("entry_time")
    await db.visits.create_index([("owner_id", 1), ("entry_time", -1)])  # Compound index
    
    # Temporary QR collection indexes
    await db.temporary_qr.create_index("token", unique=True)
    await db.temporary_qr.create_index("owner_id")
    await db.temporary_qr.create_index("expires_at")
    await db.temporary_qr.create_index("used_at")
    
    print("✅ Database indexes created")


# Collection getters for type safety
def get_users_collection():
    """Get users collection"""
    return get_database().users


def get_visitors_collection():
    """Get visitors collection"""
    return get_database().visitors


def get_visits_collection():
    """Get visits collection"""
    return get_database().visits


def get_temporary_qr_collection():
    """Get temporary_qr collection"""
    return get_database().temporary_qr

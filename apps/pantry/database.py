"""
Database configuration and connection management using Motor (async MongoDB driver)
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection settings
MONGODB_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")


class _MongoState:
    """Shared mutable state for MongoDB client and database handles."""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database: Optional[AsyncIOMotorDatabase] = None


_state = _MongoState()


async def connect_to_mongo():
    """
    Establish connection to MongoDB
    """
    try:
        _state.client = AsyncIOMotorClient(MONGODB_URL)
        _state.database = _state.client[DATABASE_NAME]

        # Test connection
        await _state.client.admin.command("ping")
        print(f"[+] Connected to MongoDB: {DATABASE_NAME}")

        # Create indexes
        await create_indexes()

    except Exception as e:
        print(f"[X] Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """
    Close MongoDB connection
    """
    if _state.client:
        _state.client.close()
        _state.client = None
        _state.database = None
        print("[-] Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """
    Get database instance
    """
    if _state.database is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return _state.database


async def create_indexes():
    """
    Create database indexes for optimal query performance
    """
    database = get_database()

    # Users collection indexes (for admins)
    await database.users.create_index("phone", unique=True)
    await database.users.create_index("role")

    # Residents collection indexes (for owners from Horizon)
    await database.residents.create_index("phone", unique=True)
    await database.residents.create_index("flat_id")
    await database.residents.create_index("created_at")

    # Guards collection indexes (for guards from Orbit)
    await database.guards.create_index("phone", unique=True)
    await database.guards.create_index("created_at")

    # Visitors collection indexes
    await database.visitors.create_index("phone")
    await database.visitors.create_index("created_by")
    await database.visitors.create_index("qr_token", unique=True, sparse=True)
    await database.visitors.create_index("is_active")

    # Visits collection indexes
    await database.visits.create_index("visitor_id")
    await database.visits.create_index("owner_id")
    await database.visits.create_index("guard_id")
    await database.visits.create_index("status")
    await database.visits.create_index("entry_time")
    await database.visits.create_index(
        [("owner_id", 1), ("entry_time", -1)]
    )  # Compound index

    # Temporary QR collection indexes
    await database.temporary_qr.create_index("token", unique=True)
    await database.temporary_qr.create_index("owner_id")
    await database.temporary_qr.create_index("expires_at")
    await database.temporary_qr.create_index("used_at")

    # Notifications collection indexes
    await database.notifications.create_index("recipient_id")
    await database.notifications.create_index("is_read")
    await database.notifications.create_index([("recipient_id", 1), ("is_read", 1)])
    await database.notifications.create_index("created_at")

    print("[+] Database indexes created")


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


def get_notifications_collection():
    """Get notifications collection"""
    return get_database().notifications


# Backward compatibility: db object that proxies to get_database()
class DatabaseProxy:
    """Proxy object that provides access to database collections"""

    @property
    def users(self):
        return get_database().users

    @property
    def residents(self):
        return get_database().residents

    @property
    def guards(self):
        return get_database().guards

    @property
    def visitors(self):
        return get_database().visitors

    @property
    def visits(self):
        return get_database().visits

    @property
    def temporary_qr(self):
        return get_database().temporary_qr

    @property
    def events(self):
        return get_database().events

    @property
    def notifications(self):
        return get_database().notifications


db = DatabaseProxy()

# Export db object for backward compatibility

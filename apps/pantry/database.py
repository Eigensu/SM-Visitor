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
    Create database indexes for optimal query performance.
    Failures are non-fatal (e.g. Atlas quota exceeded) so the app can still
    serve reads with pre-existing indexes.
    """
    import logging
    logger = logging.getLogger(__name__)

    database = get_database()

    index_ops = [
        (database.users, "phone", {"unique": True}),
        (database.users, "role", {}),
        (database.residents, "phone", {"unique": True}),
        (database.residents, "flat_id", {}),
        (database.residents, "created_at", {}),
        (database.guards, "phone", {"unique": True}),
        (database.guards, "created_at", {}),
        (database.visitors, "phone", {}),
        (database.visitors, "created_by", {}),
        (database.visitors, "qr_token", {"unique": True, "sparse": True}),
        (database.visitors, "is_active", {}),
        (database.visits, "visitor_id", {}),
        (database.visits, "owner_id", {}),
        (database.visits, "guard_id", {}),
        (database.visits, "status", {}),
        (database.visits, "entry_time", {}),
        (database.temporary_qr, "token", {"unique": True}),
        (database.temporary_qr, "owner_id", {}),
        (database.temporary_qr, "expires_at", {}),
        (database.temporary_qr, "used_at", {}),
        (database.notifications, "recipient_id", {}),
        (database.notifications, "is_read", {}),
        (database.notifications, "created_at", {}),
    ]

    compound_ops = [
        (database.visits, [("owner_id", 1), ("entry_time", -1)], {}),
        (database.notifications, [("recipient_id", 1), ("is_read", 1)], {}),
    ]

    failed = 0
    for collection, key, kwargs in index_ops:
        try:
            await collection.create_index(key, **kwargs)
        except Exception as e:
            failed += 1
            logger.warning(f"[!] Index creation skipped on {collection.name}.{key}: {e}")

    for collection, keys, kwargs in compound_ops:
        try:
            await collection.create_index(keys, **kwargs)
        except Exception as e:
            failed += 1
            logger.warning(f"[!] Compound index creation skipped on {collection.name}: {e}")

    if failed:
        logger.warning(
            f"[!] {failed} index(es) could not be created — this is usually caused by "
            "the Atlas storage quota being full. Free up space or upgrade your cluster. "
            "Existing indexes are still active; reads will work normally."
        )
    else:
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

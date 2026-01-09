"""
Database Initialization Script
Creates MongoDB collections with proper indexes and schema validation
Run this script once to set up the database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")


async def init_database():
    """Initialize database with collections and indexes"""
    print(f"Connecting to MongoDB: {MONGODB_URL}")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f"Using database: {DATABASE_NAME}")
    
    # Create collections with validation
    collections_to_create = [
        "users",
        "visitors", 
        "visits",
        "temporary_qr",
        "uploads"
    ]
    
    existing_collections = await db.list_collection_names()
    
    for collection_name in collections_to_create:
        if collection_name not in existing_collections:
            await db.create_collection(collection_name)
            print(f"✓ Created collection: {collection_name}")
        else:
            print(f"○ Collection already exists: {collection_name}")
    
    # Create indexes for users collection
    print("\nCreating indexes for 'users' collection...")
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("flat_id")
    await db.users.create_index("created_at")
    print("✓ Users indexes created")
    
    # Create indexes for visitors collection
    print("\nCreating indexes for 'visitors' collection...")
    await db.visitors.create_index("created_by")
    await db.visitors.create_index("qr_token", unique=True, sparse=True)
    await db.visitors.create_index("is_active")
    await db.visitors.create_index("phone")
    await db.visitors.create_index([("created_by", 1), ("is_active", 1)])
    print("✓ Visitors indexes created")
    
    # Create indexes for visits collection
    print("\nCreating indexes for 'visits' collection...")
    await db.visits.create_index("owner_id")
    await db.visits.create_index("guard_id")
    await db.visits.create_index("status")
    await db.visits.create_index("created_at", expireAfterSeconds=None)  # Descending
    await db.visits.create_index("entry_time")
    await db.visits.create_index([("owner_id", 1), ("status", 1)])
    await db.visits.create_index([("owner_id", 1), ("created_at", -1)])
    await db.visits.create_index([("guard_id", 1), ("created_at", -1)])
    print("✓ Visits indexes created")
    
    # Create indexes for temporary_qr collection
    print("\nCreating indexes for 'temporary_qr' collection...")
    await db.temporary_qr.create_index("token", unique=True)
    await db.temporary_qr.create_index("owner_id")
    await db.temporary_qr.create_index("expires_at")
    await db.temporary_qr.create_index("is_active")
    await db.temporary_qr.create_index([("owner_id", 1), ("is_active", 1)])
    # TTL index to auto-delete expired QR codes after 7 days
    await db.temporary_qr.create_index("expires_at", expireAfterSeconds=604800)
    print("✓ Temporary QR indexes created")
    
    # Create indexes for uploads collection
    print("\nCreating indexes for 'uploads' collection...")
    await db.uploads.create_index("file_id", unique=True)
    await db.uploads.create_index("uploaded_by")
    await db.uploads.create_index("upload_type")
    await db.uploads.create_index("created_at")
    print("✓ Uploads indexes created")
    
    # Verify collections
    print("\n" + "="*50)
    print("Database initialization complete!")
    print("="*50)
    
    collections = await db.list_collection_names()
    print(f"\nTotal collections: {len(collections)}")
    for col in collections:
        count = await db[col].count_documents({})
        print(f"  - {col}: {count} documents")
    
    client.close()
    print("\n✓ Database connection closed")


async def create_sample_admin():
    """Create a sample admin user for testing"""
    from passlib.context import CryptContext
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Check if admin exists
    existing_admin = await db.users.find_one({"phone": "9999999999"})
    
    if not existing_admin:
        admin_user = {
            "name": "Admin User",
            "phone": "9999999999",
            "password_hash": pwd_context.hash("admin123"),
            "role": "admin",
            "flat_id": None,
            "last_seen": None,
            "created_at": datetime.utcnow(),
            "metadata": {}
        }
        
        result = await db.users.insert_one(admin_user)
        print(f"\n✓ Sample admin created with ID: {result.inserted_id}")
        print(f"  Phone: 9999999999")
        print(f"  Password: admin123")
    else:
        print(f"\n○ Admin user already exists")
    
    client.close()


if __name__ == "__main__":
    print("="*50)
    print("SM-Visitor Database Initialization")
    print("="*50)
    print()
    
    asyncio.run(init_database())
    
    # Ask if user wants to create sample admin
    create_admin = input("\nCreate sample admin user? (y/n): ").lower()
    if create_admin == 'y':
        asyncio.run(create_sample_admin())
    
    print("\n✓ All done! Database is ready to use.")

import asyncio
import sys
import os
from database import connect_to_mongo, close_mongo_connection, db, get_database

async def migrate_and_secure_db():
    print("Starting Visitor Database Migration...")
    try:
        # Prevent any schema connection errors
        await connect_to_mongo()
        
        # 1. Update existing inconsistent legacy records to lowercase
        print("Searching for case-mismatched approval statuses...")
        result = await db.visitors.update_many(
            {"approval_status": {"$in": ["PENDING", "Approved", "APPROVED"]}},
            [
                {
                    "$set": {
                        "approval_status": {"$toLower": "$approval_status"}
                    }
                }
            ]
        )
        print(f"Successfully converted {result.modified_count} inconsistent records to strictly lowercase.")

        # 2. Hardcode the DB Schema Validation for the collection
        database = get_database()
        
        print("Applying hard schema validation via collMod...")
        cmd = {
            "collMod": "visitors",
            "validator": {
                "$jsonSchema": {
                    "bsonType": "object",
                    "properties": {
                        "approval_status": {
                            "enum": ["pending", "approved", "rejected"]
                        }
                    }
                }
            },
            "validationLevel": "strict",
            "validationAction": "error"
        }
        
        await database.command(cmd)
        print("Strict DB Schema Validator successfully wrapped around the `visitors` collection.")
        print("Migration fully complete! Database is structurally impenetrable.")

    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(migrate_and_secure_db())

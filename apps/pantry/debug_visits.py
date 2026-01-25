"""
Quick debug script to check visits and users in MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_database():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["sm_visitor"]
    
    print("=== USERS (OWNERS) ===")
    owners = await db.users.find({"role": "owner"}).to_list(length=10)
    for owner in owners:
        print(f"Owner: {owner['name']} | ID: {owner['_id']} | Flat: {owner.get('flat_id', 'N/A')}")
    
    print("\n=== PENDING VISITS ===")
    visits = await db.visits.find({"status": "pending"}).to_list(length=10)
    for visit in visits:
        print(f"Visitor: {visit['name_snapshot']} | Owner ID: {visit['owner_id']} | Type: {type(visit['owner_id'])}")
    
    print(f"\n=== TOTALS ===")
    print(f"Total owners: {await db.users.count_documents({'role': 'owner'})}")
    print(f"Total pending visits: {await db.visits.count_documents({'status': 'pending'})}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_database())

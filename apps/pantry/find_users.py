"""
List ALL databases in MongoDB to find where users actually are
"""
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")

print("=" * 60)
print("ALL DATABASES IN MONGODB:")
print("=" * 60)

# List all databases
for db_name in client.list_database_names():
    db = client[db_name]
    collections = db.list_collection_names()
    
    print(f"\nDatabase: {db_name}")
    print(f"Collections: {collections}")
    
    # If it has a users collection, show count
    if 'users' in collections:
        users_count = db.users.count_documents({})
        owners_count = db.users.count_documents({"role": "owner"})
        guards_count = db.users.count_documents({"role": "guard"})
        print(f"  👥 Users: {users_count} total ({owners_count} owners, {guards_count} guards)")
    
    # If it has visits collection, show count
    if 'visits' in collections:
        visits_count = db.visits.count_documents({})
        pending_count = db.visits.count_documents({"status": "pending"})
        print(f"  📋 Visits: {visits_count} total ({pending_count} pending)")

client.close()

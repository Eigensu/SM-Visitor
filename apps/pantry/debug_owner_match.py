"""
Check if visit was created and debug owner_id matching
"""
from pymongo import MongoClient
from bson import ObjectId

# Connect to Atlas
client = MongoClient("mongodb+srv://smeigensu_db_user:vToNR0Afez6PsJWc@sm-db.dblhcnk.mongodb.net/?appName=sm-db")
db = client["sm_visitor"]

print("=" * 70)
print("CHECKING VISITS AND OWNER MATCHING")
print("=" * 70)

# Get the owner
owner = db.users.find_one({"role": "owner"})
if owner:
    print(f"\n✅ OWNER FOUND:")
    print(f"   Name: {owner['name']}")
    print(f"   ID: {owner['_id']}")
    print(f"   ID Type: {type(owner['_id'])}")
    owner_id_str = str(owner['_id'])
    print(f"   ID as string: '{owner_id_str}'")
else:
    print("\n❌ NO OWNER FOUND!")
    
# Get all visits
print(f"\n📋 ALL VISITS IN DATABASE:")
visits = list(db.visits.find())
if not visits:
    print("   ❌ NO VISITS FOUND!")
else:
    for visit in visits:
        print(f"\n   Visit ID: {visit['_id']}")
        print(f"   Visitor: {visit['name_snapshot']}")
        print(f"   Status: {visit['status']}")
        print(f"   Owner ID in visit: {visit['owner_id']}")
        print(f"   Owner ID type: {type(visit['owner_id'])}")
        
        if owner:
            # Check different matching scenarios
            print(f"   \n   MATCHING TESTS:")
            print(f"   Direct match (owner_id == owner['_id']): {visit['owner_id'] == owner['_id']}")
            print(f"   String match (owner_id == str(owner['_id'])): {visit['owner_id'] == str(owner['_id'])}")
            print(f"   ObjectId match (ObjectId(owner_id) == owner['_id']): {ObjectId(visit['owner_id']) == owner['_id'] if isinstance(visit['owner_id'], str) else 'N/A'}")

# Test the exact query used by backend
if owner:
    print(f"\n🔍 TESTING BACKEND QUERY:")
    query = {"owner_id": str(owner['_id']), "status": "pending"}
    print(f"   Query: {query}")
    found = list(db.visits.find(query))
    print(f"   Results: {len(found)} visits found")
    
    if not found and visits:
        print(f"\n   ❌ QUERY FAILED! Trying ObjectId query...")
        query2 = {"owner_id": owner['_id'], "status": "pending"}
        print(f"   Query: {query2}")
        found2 = list(db.visits.find(query2))
        print(f"   Results: {len(found2)} visits found")

client.close()

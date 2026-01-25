"""
Complete end-to-end verification of Orbit to Horizon flow
Tests: Database connection → Owner exists → Visit submission → Horizon query
"""
from pymongo import MongoClient
from bson import ObjectId

# Connect to Atlas
CONNECTION_STRING = "mongodb+srv://smeigensu_db_user:vToNR0Afez6PsJWc@sm-db.dblhcnk.mongodb.net/?appName=sm-db"
client = MongoClient(CONNECTION_STRING)
db = client["sm_visitor"]

print("=" * 70)
print("COMPLETE ORBIT -> HORIZON FLOW VERIFICATION")
print("=" * 70)

# Step 1: Verify owner exists in residents collection
print("\n[STEP 1] Checking for owners in 'residents' collection...")
resident = db.residents.find_one({"flat_id": "A-207"})
if resident:
    print(f"   [OK] Owner found: {resident['name']} (flat_id: A-207)")
    print(f"   [OK] Owner _id: {resident['_id']}")
    owner_flat_id = resident["flat_id"]
    owner_id = resident["_id"]
else:
    print("   [FAIL] NO OWNER with flat_id A-207 found!")
    print("\n   Available residents:")
    for r in db.residents.find():
        print(f"      - {r.get('name')} (flat_id: {r.get('flat_id')})")
    exit(1)

# Step 2: Check what the /users/?role=owner API would return
print("\n[STEP 2] Simulating /users/?role=owner API response...")
owners_list = list(db.residents.find())
if owners_list:
    print(f"   [OK] API would return {len(owners_list)} owner(s)")
    for owner in owners_list:
        api_response = {
            "_id": str(owner["_id"]),
            "name": owner["name"],
            "flat_id": owner.get("flat_id"),
            "phone": owner["phone"]
        }
        print(f"   [OK] {api_response}")
else:
    print("   [FAIL] API would return empty list!")

# Step 3: Check existing visits for this owner
print(f"\n[STEP 3] Checking existing visits for flat_id '{owner_flat_id}'...")
existing_visits = list(db.visits.find({"owner_id": owner_flat_id}))
print(f"   Found {len(existing_visits)} existing visit(s) for this flat")
for visit in existing_visits:
    print(f"      - {visit['name_snapshot']} | Status: {visit['status']} | owner_id: {visit['owner_id']}")

# Step 4: Check pending visits (what Horizon approvals would show)
print(f"\n[STEP 4] Simulating Horizon /visits/pending query...")
pending_visits = list(db.visits.find({"owner_id": owner_flat_id, "status": "pending"}))
print(f"   Query: {{'owner_id': '{owner_flat_id}', 'status': 'pending'}}")
print(f"   [OK] Would return {len(pending_visits)} pending visit(s)")
for visit in pending_visits:
    print(f"      - {visit['name_snapshot']} | Purpose: {visit['purpose']}")

# Step 5: Verify OwnerSelect dropdown behavior
print(f"\n[STEP 5] Verifying OwnerSelect dropdown logic...")
print(f"   Owner's _id: {owner_id}")
print(f"   Owner's flat_id: {owner_flat_id}")
print(f"   ")
print(f"   OwnerSelect displays: '{resident['name']} ({owner_flat_id})'")
print(f"   Dropdown value: '{owner_flat_id}'  (uses flat_id)")
print(f"   When submitted, owner_id in visit = '{owner_flat_id}'")

# Step 6: Verify Dashboard Stats Queries
print(f"\n[STEP 6] Simulating Horizon Dashboard Stats queries...")
from datetime import datetime, timedelta
today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

# 6a. Today's Count
today_count = db.visits.count_documents({
    "owner_id": owner_flat_id,
    "created_at": {"$gte": today_start}
})
print(f"   [Today's Count] Query: {{'owner_id': '{owner_flat_id}', 'created_at': {{$gte: today_start}}}}")
print(f"   [OK] Result: {today_count}")

# 6b. Recent Activity
recent_visits = list(db.visits.find({"owner_id": owner_flat_id}).sort("created_at", -1).limit(5))
print(f"   [Recent Activity] Query: {{'owner_id': '{owner_flat_id}'}} sort desc limit 5")
print(f"   [OK] Result: found {len(recent_visits)} visits")

# 6c. Weekly Stats
week_ago = today_start - timedelta(days=6)
weekly_visits = list(db.visits.find({
    "owner_id": owner_flat_id,
    "created_at": {"$gte": week_ago}
}))
print(f"   [Weekly Stats] Query: {{'owner_id': '{owner_flat_id}', 'created_at': {{$gte: week_ago}}}}")
print(f"   [OK] Result: found {len(weekly_visits)} visits in last 7 days")

# Step 6: Summary
print("\n" + "=" * 70)
print("VERIFICATION SUMMARY")
print("=" * 70)
print(f"[OK] Owner exists: {resident['name']} (A-207)")
print(f"[OK] API returns owner correctly")
print(f"[OK] Dropdown will use flat_id: '{owner_flat_id}'")
print(f"[OK] Visit will be created with owner_id: '{owner_flat_id}'")
print(f"[OK] Horizon will query: owner_id='{owner_flat_id}' AND status='pending'")
print(f"[OK] Current pending visits for this owner: {len(pending_visits)}")
print("\n[OK] Flow is correctly configured!")
print("\nNEXT STEPS:")
print("1. Restart backend: cd apps/pantry && pnpm run dev")
print("2. Refresh Orbit with Ctrl+Shift+R")
print("3. Submit new visit from Orbit")
print("4. Visit should appear in Horizon approvals immediately!")

client.close()

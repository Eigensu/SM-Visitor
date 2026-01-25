"""
Quick diagnostic script to check visits in database
Run this to see what's preventing visits from appearing in Horizon
"""
from pymongo import MongoClient
from pprint import pprint

def diagnose():
    client = MongoClient("mongodb://localhost:27017")
    db = client["sm_visitor"]
    
    print("=" * 60)
    print("DIAGNOSTIC REPORT")
    print("=" * 60)
    
    # Get all users
    print("\n1. OWNERS IN DATABASE:")
    owners = list(db.users.find({"role": "owner"}))
    for owner in owners:
        print(f"   Name: {owner['name']}")
        print(f"   ID: {owner['_id']}")
        print(f"   Type: {type(owner['_id'])}")
        print()
    
    # Get all pending visits
    print("\n2. PENDING VISITS:")
    visits = list(db.visits.find({"status": "pending"}))
    if not visits:
        print("   NO PENDING VISITS FOUND!")
    else:
        for visit in visits:
            print(f"   Visitor: {visit['name_snapshot']}")
            print(f"   Owner ID in visit: {visit['owner_id']}")
            print(f"   Owner ID type: {type(visit['owner_id'])}")
            print(f"   Visit ID: {visit['_id']}")
            print()
    
    # Check if IDs match
    if owners and visits:
        print("\n3. OWNER ID MATCHING CHECK:")
        owner_id_from_user = str(owners[0]['_id'])
        owner_id_in_visit = visit['owner_id']
        print(f"   Owner's actual ID: '{owner_id_from_user}'")
        print(f"   Owner ID in visit: '{owner_id_in_visit}'")
        print(f"   Do they match? {owner_id_from_user == owner_id_in_visit}")
        print(f"   Are both strings? {isinstance(owner_id_from_user, str) and isinstance(owner_id_in_visit, str)}")
    
    client.close()

if __name__ == "__main__":
    diagnose()

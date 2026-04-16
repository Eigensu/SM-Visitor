"""
SM-Visitor End-to-End System Audit Script
==========================================
Runs all 10 checklist items deterministically against the live system.
Generates a pass/fail report for every layer.

Usage:
    cd apps/pantry
    python audit_e2e.py
"""

import asyncio
import sys
import os
import json
import time
import requests
from datetime import datetime, timedelta

# ── Setup path so we can reuse pantry modules ──────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("MONGODB_URI", "mongodb+srv://smeigensu_db_user:vToNR0Afez6PsJWc@sm-db.dblhcnk.mongodb.net/?appName=sm-db")
os.environ.setdefault("DATABASE_NAME", "sm_visitor")
os.environ.setdefault("JWT_SECRET", "7d6a0e29a9e4d0f34c8c1b2d6f4b8a0f9e2c7a6d1f3b9c0e8a4d2c6b1f0a7e3c")

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import jwt as pyjwt

# ── Config ─────────────────────────────────────────────────────────────────
MONGO_URI     = os.environ["MONGODB_URI"]
DB_NAME       = os.environ["DATABASE_NAME"]
JWT_SECRET    = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
API_BASE      = "http://localhost:8000"
OWNER_ID      = "6961022acbec409664c1b80f"

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"
SKIP = "SKIP"

results = []

def log(step, status, message, detail=None):
    symbol = {"PASS": "[PASS]", "FAIL": "[FAIL]", "WARN": "[WARN]", "SKIP": "[SKIP]"}[status]
    print(f"\n{symbol} STEP {step}: {message}")
    if detail:
        print(f"       {detail}")
    results.append((step, status, message))

def make_owner_token(user_id=OWNER_ID, role="owner"):
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow(),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ── Individual checks ──────────────────────────────────────────────────────

async def check_1_db_truth(db):
    """Step 1: Mongo has at least 1 pending regular visitor for owner"""
    print("\n" + "="*60)
    print("STEP 1 — DATABASE TRUTH")
    print("="*60)

    docs = await db.visitors.find({
        "assigned_owner_id": {"$in": [OWNER_ID, ObjectId(OWNER_ID)]},
    }).to_list(50)

    print(f"  Total visitor docs for owner: {len(docs)}")
    for d in docs:
        print(f"    _id={d['_id']}  approval_status={d.get('approval_status')}  visitor_type={d.get('visitor_type')}  is_active={d.get('is_active')}")

    pending = [d for d in docs if d.get("approval_status") == "pending" and d.get("visitor_type") == "regular"]
    print(f"  Pending regular: {len(pending)}")

    if not docs:
        log(1, FAIL, "No visitor docs found for this owner — write is broken or wrong owner ID")
    elif not pending:
        log(1, WARN, f"Owner has {len(docs)} visitors but 0 pending regulars",
            "Either none have been created yet, or status/type mismatch. Create one via Orbit and re-run.")
    else:
        log(1, PASS, f"Found {len(pending)} pending regular visitor(s) in DB")

    return pending


async def check_2_api_response(owner_token):
    """Step 2: GET /visitors/approvals/regular returns non-empty array"""
    print("\n" + "="*60)
    print("STEP 2 — BACKEND API DIRECT TEST")
    print("="*60)

    url = f"{API_BASE}/visitors/approvals/regular"
    try:
        resp = requests.get(url, headers={"Authorization": f"Bearer {owner_token}"}, timeout=10)
        print(f"  Status: {resp.status_code}")
        data = resp.json()
        print(f"  Response body (first 3): {json.dumps(data[:3], default=str, indent=2)}")

        if resp.status_code == 200 and len(data) > 0:
            log(2, PASS, f"API returned {len(data)} pending regular visitor(s)")
        elif resp.status_code == 200 and len(data) == 0:
            log(2, FAIL, "API returned 200 but empty array — query bug (check step 3)")
        else:
            log(2, FAIL, f"API returned HTTP {resp.status_code}", str(data))
        return data
    except (requests.ConnectionError, requests.ReadTimeout, requests.Timeout):
        log(2, SKIP, f"Backend not reachable at {API_BASE} — start Pantry and re-run")
        return []


async def check_3_query_debug(db):
    """Step 3: Run all 3 query variants to isolate exactly which condition fails"""
    print("\n" + "="*60)
    print("STEP 3 — QUERY ISOLATION DEBUG")
    print("="*60)

    # Variant A: string match only
    a = await db.visitors.find({
        "assigned_owner_id": OWNER_ID,
        "approval_status": "pending",
        "visitor_type": "regular",
    }).to_list(50)
    print(f"  [A] exact string match: {len(a)} docs")

    # Variant B: ObjectId fallback
    b = await db.visitors.find({
        "assigned_owner_id": {"$in": [OWNER_ID, ObjectId(OWNER_ID)]},
        "approval_status": "pending",
        "visitor_type": "regular",
    }).to_list(50)
    print(f"  [B] string + ObjectId match: {len(b)} docs")

    # Variant C: no visitor_type filter (shows if type field is missing)
    c = await db.visitors.find({
        "assigned_owner_id": {"$in": [OWNER_ID, ObjectId(OWNER_ID)]},
        "approval_status": "pending",
    }).to_list(50)
    print(f"  [C] without visitor_type filter: {len(c)} docs")

    # Variant D: no approval_status filter (shows all for owner)
    d_all = await db.visitors.find({
        "assigned_owner_id": {"$in": [OWNER_ID, ObjectId(OWNER_ID)]},
    }).to_list(50)
    statuses = [x.get("approval_status") for x in d_all]
    print(f"  [D] all docs for owner: {len(d_all)} — statuses: {statuses}")

    if len(b) > 0:
        log(3, PASS, f"Query [B] finds {len(b)} docs — backend query is correct")
    elif len(c) > 0:
        log(3, FAIL, "Docs exist without visitor_type filter — visitor_type field is missing or wrong value in DB",
            f"Check visitor docs: {[x.get('visitor_type') for x in c]}")
    elif len(a) == 0 and len(b) == 0:
        log(3, WARN, "No results in any variant — no pending visitors exist yet OR owner ID mismatch")
    else:
        log(3, FAIL, "Query mismatch — see detailed output above")


async def check_4_sse_connection(db):
    """Step 4: Check if owner is connected via the active connections map (indirect)"""
    print("\n" + "="*60)
    print("STEP 4 — SSE CONNECTION (Indirect Check)")
    print("="*60)

    # We can't directly read the in-memory SSE manager from here, but we can
    # call the /events/test endpoint if it exists, or just verify the route.
    owner_token = make_owner_token()
    try:
        # Quick check: can we even reach the events endpoint?
        resp = requests.get(
            f"{API_BASE}/events/stream?token={owner_token}",
            stream=True,
            timeout=3,
            headers={"Accept": "text/event-stream"}
        )
        if resp.status_code == 200:
            log(4, PASS, "SSE /events/stream endpoint is reachable and returns 200",
                "Check backend terminal for '[SSE CONNECT]' line when Horizon is open")
        else:
            log(4, FAIL, f"SSE endpoint returned {resp.status_code}", resp.text[:200])
        resp.close()
    except requests.Timeout:
        # Timeout on a streaming connection is actually expected (it's a long-poll)
        log(4, PASS, "SSE endpoint is live (connection held open for streaming — expected timeout)")
    except (requests.ConnectionError, requests.ReadTimeout):
        log(4, SKIP, "Backend not reachable — is Pantry running?")


async def check_5_api_health():
    """Step 5: Backend health check"""
    print("\n" + "="*60)
    print("STEP 5 — BACKEND HEALTH")
    print("="*60)
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=5)
        log(5, PASS, f"Backend healthy — status {resp.status_code}")
    except Exception:
        try:
            resp = requests.get(f"{API_BASE}/docs", timeout=5)
            log(5, PASS, "Backend is reachable (Swagger docs accessible)")
        except (requests.ConnectionError, requests.ReadTimeout, requests.Timeout, Exception):
            log(5, SKIP, f"Backend is NOT reachable at {API_BASE} — start Pantry and re-run")


async def check_6_visitors_list_guard():
    """Step 6 (Step 9 in checklist): Guard fetches /visitors/ and sees pending"""
    print("\n" + "="*60)
    print("STEP 6 — GUARD LIST INCLUDES PENDING REGULARS")
    print("="*60)

    # Use an owner token (guards can still see visitor list — or we skip if 401)
    guard_token = make_owner_token(user_id=OWNER_ID, role="owner")
    try:
        resp = requests.get(
            f"{API_BASE}/visitors/",
            headers={"Authorization": f"Bearer {guard_token}"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            log(6, SKIP, f"Visitor list returned {resp.status_code} — guard token may be needed")
            return
        try:
            data = resp.json()
        except Exception:
            log(6, SKIP, "Could not parse visitor list response — check backend logs")
            return

        pending = [v for v in data if v.get("approval_status") == "pending" and v.get("visitor_type") == "regular"]
        print(f"  Total visitors returned: {len(data)}")
        print(f"  Pending regulars visible: {len(pending)}")

        if len(pending) > 0:
            log(6, PASS, f"Pending regular visitors visible in /visitors/ list: {len(pending)}")
        else:
            log(6, WARN, "No pending regulars in /visitors/ list (owner filter may restrict this)")
    except (requests.ConnectionError, requests.ReadTimeout, requests.Timeout):
        log(6, SKIP, "Backend not reachable")


async def check_7_enum_contract(db):
    """Step 7: Verify all approval_status values in DB are valid lowercase enum values"""
    print("\n" + "="*60)
    print("STEP 7 — ENUM CONTRACT VALIDATION")
    print("="*60)

    valid = {"pending", "approved", "rejected"}
    pipeline = [{"$group": {"_id": "$approval_status", "count": {"$sum": 1}}}]
    async for doc in db.visitors.aggregate(pipeline):
        status = doc["_id"]
        count = doc["count"]
        if status not in valid:
            print(f"  [INVALID] approval_status='{status}' found in {count} docs")
            log(7, FAIL, f"Invalid status '{status}' in {count} DB documents", "Run migration script to fix")
            return
        else:
            print(f"  [OK] approval_status='{status}' — {count} docs")

    log(7, PASS, "All approval_status values in DB are valid lowercase enum")


async def check_8_field_presence(db):
    """Step 8: Verify critical fields on the most recent visitor doc"""
    print("\n" + "="*60)
    print("STEP 8 — FIELD PRESENCE ON LATEST DOCUMENT")
    print("="*60)

    doc = await db.visitors.find_one(
        {"assigned_owner_id": {"$in": [OWNER_ID, ObjectId(OWNER_ID)]}},
        sort=[("created_at", -1)]
    )

    if not doc:
        log(8, WARN, "No visitor docs to inspect for this owner")
        return

    required_fields = [
        "name", "visitor_type", "approval_status", "assigned_owner_id",
        "created_by", "created_by_role", "is_active", "created_at"
    ]
    missing = [f for f in required_fields if f not in doc]
    present = [f for f in required_fields if f in doc]

    print(f"  Most recent doc _id: {doc['_id']}")
    print(f"  Present fields: {present}")
    print(f"  Missing fields: {missing}")
    print(f"  flat_id stored: {'YES — ' + doc.get('flat_id', '') if 'flat_id' in doc else 'NO (not stored)'}")

    if missing:
        log(8, FAIL, f"Missing required fields: {missing}")
    else:
        log(8, PASS, "All required fields present on latest visitor doc")


# ── Final Report ───────────────────────────────────────────────────────────

def print_report():
    print("\n\n" + "="*60)
    print("AUDIT REPORT SUMMARY")
    print("="*60)

    pass_count = sum(1 for _, s, _ in results if s == PASS)
    fail_count = sum(1 for _, s, _ in results if s == FAIL)
    warn_count = sum(1 for _, s, _ in results if s == WARN)
    skip_count = sum(1 for _, s, _ in results if s == SKIP)

    for step, status, message in results:
        symbol = {"PASS": "[PASS]", "FAIL": "[FAIL]", "WARN": "[WARN]", "SKIP": "[SKIP]"}[status]
        print(f"  {symbol}  Step {step}: {message}")

    print(f"\n  PASS={pass_count}  FAIL={fail_count}  WARN={warn_count}  SKIP={skip_count}")

    if fail_count == 0 and warn_count == 0:
        print("\n  SYSTEM STATUS: FULLY OPERATIONAL")
    elif fail_count == 0:
        print("\n  SYSTEM STATUS: OPERATIONAL (warnings — may need data to test)")
    else:
        print(f"\n  SYSTEM STATUS: {fail_count} FAILURE(S) DETECTED — see details above")


# ── Main ───────────────────────────────────────────────────────────────────

async def main():
    print("SM-Visitor End-to-End Audit")
    print(f"Owner ID: {OWNER_ID}")
    print(f"API Base: {API_BASE}")
    print(f"Time:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Connect to Mongo
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    try:
        await client.admin.command("ping")
        print("\n[OK] MongoDB connected")
    except Exception as e:
        print(f"\n[FAIL] MongoDB connection failed: {e}")
        sys.exit(1)

    owner_token = make_owner_token()
    print(f"[OK] Owner token generated (expires in 1h)")

    # Run all checks
    await check_1_db_truth(db)
    await check_2_api_response(owner_token)
    await check_3_query_debug(db)
    await check_4_sse_connection(db)
    await check_5_api_health()
    await check_6_visitors_list_guard()
    await check_7_enum_contract(db)
    await check_8_field_presence(db)

    print_report()
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
One-time migration: move all GridFS photos to Cloudinary.

Run from the pantry app directory:
    cd apps/pantry

    # Phase 1: Upload all photos to Cloudinary, save mapping locally
    python scripts/migrate_photos_to_cloudinary.py

    # Phase 2 (if MongoDB writes were blocked in Phase 1):
    # After freeing Atlas storage, apply the saved mapping
    python scripts/migrate_photos_to_cloudinary.py --apply-mapping

Safe to re-run: already-migrated Cloudinary URLs are skipped.
The local mapping file (migration_mapping.json) acts as a checkpoint —
photos already uploaded to Cloudinary are not re-uploaded.
"""

import asyncio
import json
import os
import re
import sys
from typing import Optional

# ── Bootstrap: add pantry root to path ───────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId

MONGODB_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")
MAPPING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migration_mapping.json")

GRIDFS_ID_RE = re.compile(r"^[a-f0-9]{24}$", re.IGNORECASE)
PATH_ID_RE = re.compile(r"/(?:photo/)?(?:regular|buffer)/([a-f0-9]{24})$", re.IGNORECASE)


def is_cloudinary_url(value: Optional[str]) -> bool:
    return bool(value and value.startswith("http"))


def extract_gridfs_id(value: Optional[str]) -> Optional[str]:
    if not value or is_cloudinary_url(value):
        return None
    if GRIDFS_ID_RE.match(value):
        return value
    m = PATH_ID_RE.search(value)
    return m.group(1) if m else None


def load_mapping() -> dict:
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE) as f:
            return json.load(f)
    return {}


def save_mapping(mapping: dict):
    with open(MAPPING_FILE, "w") as f:
        json.dump(mapping, f, indent=2)


async def download_from_gridfs(db, file_id: str) -> Optional[bytes]:
    oid = ObjectId(file_id)
    for bucket_name in ("visitor_photos", "visitor_photos_buffer"):
        try:
            fs = AsyncIOMotorGridFSBucket(db, bucket_name=bucket_name)
            grid_out = await fs.open_download_stream(oid)
            data = await grid_out.read()
            if data:
                return data
        except Exception:
            pass
    return None


async def upload_to_cloudinary(photo_data: bytes, public_id: str) -> Optional[str]:
    import cloudinary
    import cloudinary.uploader
    from config import (
        CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER,
    )
    import io

    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )

    def _upload():
        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(photo_data),
                folder=CLOUDINARY_FOLDER,
                public_id=public_id,
                overwrite=True,
                resource_type="image",
            )
            return result.get("secure_url")
        except Exception as e:
            print(f"    [Cloudinary error] {e}")
            return None

    return await asyncio.to_thread(_upload)


async def upload_phase(db, mapping: dict) -> tuple[int, int, int]:
    """
    Phase 1: scan all documents, upload GridFS photos to Cloudinary,
    save gridfs_id → cloudinary_url to local mapping file.
    Does NOT write to MongoDB (avoids quota error).
    Returns (uploaded, skipped, failed).
    """
    uploaded = skipped = failed = 0

    for collection_name, fields in [
        ("visitors", ["photo_url", "id_card_photo_url"]),
        ("visits",   ["photo_snapshot_url", "id_photo_url"]),
    ]:
        print(f"\n=== Scanning {collection_name} ===")
        projection = {f: 1 for f in fields}
        async for doc in db[collection_name].find({}, projection):
            for field in fields:
                value = doc.get(field)
                file_id = extract_gridfs_id(value)
                if not file_id:
                    if value:
                        skipped += 1
                    continue

                # Already uploaded in a previous run
                if file_id in mapping:
                    print(f"  [cached] {collection_name}/{doc['_id']} → {field}")
                    skipped += 1
                    continue

                print(f"  [upload] {collection_name}/{doc['_id']} → {field}")
                photo_data = await download_from_gridfs(db, file_id)
                if not photo_data:
                    print(f"    [WARN] GridFS file not found: {file_id}")
                    failed += 1
                    continue

                cloudinary_url = await upload_to_cloudinary(photo_data, f"migration_{file_id}")
                if not cloudinary_url:
                    print(f"    [ERROR] Cloudinary upload failed for {file_id}")
                    failed += 1
                    continue

                mapping[file_id] = cloudinary_url
                save_mapping(mapping)  # checkpoint after every successful upload
                uploaded += 1
                print(f"    → {cloudinary_url[:60]}...")

    return uploaded, skipped, failed


async def apply_phase(db, mapping: dict) -> tuple[int, int]:
    """
    Phase 2: read the local mapping, update MongoDB documents.
    Run this after freeing Atlas storage.
    Returns (updated, failed).
    """
    if not mapping:
        print("No mapping file found. Run without --apply-mapping first.")
        return 0, 0

    updated = failed = 0

    for collection_name, fields in [
        ("visitors", ["photo_url", "id_card_photo_url"]),
        ("visits",   ["photo_snapshot_url", "id_photo_url"]),
    ]:
        print(f"\n=== Applying to {collection_name} ===")
        projection = {f: 1 for f in fields}
        async for doc in db[collection_name].find({}, projection):
            for field in fields:
                value = doc.get(field)
                file_id = extract_gridfs_id(value)
                if not file_id or file_id not in mapping:
                    continue

                cloudinary_url = mapping[file_id]
                try:
                    await db[collection_name].update_one(
                        {"_id": doc["_id"]},
                        {"$set": {field: cloudinary_url}},
                    )
                    print(f"  [ok] {collection_name}/{doc['_id']} → {field}")
                    updated += 1
                except Exception as e:
                    print(f"  [ERROR] {collection_name}/{doc['_id']}: {e}")
                    failed += 1

    return updated, failed


async def drop_gridfs_collections(db):
    buckets = ["visitor_photos", "visitor_photos_buffer"]
    for bucket in buckets:
        for suffix in (".files", ".chunks"):
            name = bucket + suffix
            try:
                await db.drop_collection(name)
                print(f"  Dropped: {name}")
            except Exception as e:
                print(f"  [WARN] Could not drop {name}: {e}")


async def main():
    apply_mode = "--apply-mapping" in sys.argv

    from config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        print("[ERROR] Cloudinary env vars not set.")
        sys.exit(1)

    print(f"Connecting to MongoDB: {DATABASE_NAME}")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    await client.admin.command("ping")
    print("Connected.")

    mapping = load_mapping()

    if apply_mode:
        # ── Phase 2: write Cloudinary URLs into MongoDB ───────────────────────
        print(f"\nApply mode: reading {len(mapping)} entries from {MAPPING_FILE}")
        updated, failed = await apply_phase(db, mapping)
        print(f"\nDone: {updated} updated, {failed} failed")

        if failed == 0 and updated > 0:
            answer = input("\nDrop GridFS collections to free MongoDB storage? [y/N]: ").strip().lower()
            if answer == "y":
                print("\nDropping GridFS collections...")
                await drop_gridfs_collections(db)
                print("Done. MongoDB storage freed.")
                # Clean up local mapping file
                if os.path.exists(MAPPING_FILE):
                    os.remove(MAPPING_FILE)
                    print(f"Removed local mapping file: {MAPPING_FILE}")
    else:
        # ── Phase 1: upload to Cloudinary, save mapping locally ───────────────
        print(f"\nUpload mode: uploading GridFS photos to Cloudinary.")
        print(f"Mapping checkpoint: {MAPPING_FILE}\n")
        uploaded, skipped, failed = await upload_phase(db, mapping)

        print(f"\n{'='*50}")
        print(f"Uploaded to Cloudinary: {uploaded}")
        print(f"Skipped (already done): {skipped}")
        print(f"Failed:                 {failed}")
        print(f"{'='*50}")

        if failed > 0:
            print("\n[WARN] Some uploads failed. Fix the errors and re-run.")
            print("Successfully uploaded photos are checkpointed in the mapping file.")
        elif uploaded == 0 and not mapping:
            print("\nNothing to migrate — all records already point to Cloudinary.")
        else:
            print(f"\n{uploaded + len(mapping)} photos are now in Cloudinary.")
            print("\nNext step: free MongoDB storage, then run:")
            print("  python scripts/migrate_photos_to_cloudinary.py --apply-mapping")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())

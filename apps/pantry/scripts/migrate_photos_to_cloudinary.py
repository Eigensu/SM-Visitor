#!/usr/bin/env python3
"""
One-time migration: move all GridFS photos to Cloudinary.

Run from the pantry app directory:
    cd apps/pantry
    python scripts/migrate_photos_to_cloudinary.py

After a successful migration:
  - All visitor.photo_url / visitor.id_card_photo_url fields will be Cloudinary URLs
  - All visit.photo_snapshot_url / visit.id_photo_url fields will be Cloudinary URLs
  - The script will offer to drop the GridFS collections to free MongoDB storage

Safe to re-run: already-migrated documents (Cloudinary URLs) are skipped.
"""

import asyncio
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

GRIDFS_ID_RE = re.compile(r"^[a-f0-9]{24}$", re.IGNORECASE)
PATH_ID_RE = re.compile(r"/(?:photo/)?(?:regular|buffer)/([a-f0-9]{24})$", re.IGNORECASE)


def is_cloudinary_url(value: Optional[str]) -> bool:
    return bool(value and value.startswith("http"))


def extract_gridfs_id(value: Optional[str]) -> Optional[str]:
    """Return a bare 24-char GridFS ObjectId from a raw ID or legacy path."""
    if not value:
        return None
    if is_cloudinary_url(value):
        return None
    if GRIDFS_ID_RE.match(value):
        return value
    m = PATH_ID_RE.search(value)
    return m.group(1) if m else None


async def download_from_gridfs(db, file_id: str) -> Optional[bytes]:
    """Try visitor_photos first, then visitor_photos_buffer."""
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
    """Upload bytes to Cloudinary synchronously (run in thread). Returns URL or None."""
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


async def migrate_field(db, collection_name: str, doc_id, field: str, value: str) -> bool:
    """Download from GridFS, upload to Cloudinary, update the document. Returns True on success."""
    file_id = extract_gridfs_id(value)
    if not file_id:
        return False

    photo_data = await download_from_gridfs(db, file_id)
    if not photo_data:
        print(f"    [WARN] GridFS file not found: {file_id} ({field})")
        return False

    public_id = f"migration_{file_id}"
    cloudinary_url = await upload_to_cloudinary(photo_data, public_id)
    if not cloudinary_url:
        print(f"    [ERROR] Cloudinary upload failed for {file_id}")
        return False

    collection = db[collection_name]
    await collection.update_one({"_id": doc_id}, {"$set": {field: cloudinary_url}})
    return True


async def migrate_visitors(db) -> tuple[int, int, int]:
    """Migrate photo_url and id_card_photo_url on the visitors collection."""
    collection = db.visitors
    migrated = skipped = failed = 0

    async for doc in collection.find({}, {"photo_url": 1, "id_card_photo_url": 1}):
        doc_id = doc["_id"]

        for field in ("photo_url", "id_card_photo_url"):
            value = doc.get(field)
            if not value:
                continue
            if is_cloudinary_url(value):
                skipped += 1
                continue
            if not extract_gridfs_id(value):
                skipped += 1
                continue

            print(f"  visitors/{doc_id} → {field}")
            ok = await migrate_field(db, "visitors", doc_id, field, value)
            if ok:
                migrated += 1
            else:
                failed += 1

    return migrated, skipped, failed


async def migrate_visits(db) -> tuple[int, int, int]:
    """Migrate photo_snapshot_url and id_photo_url on the visits collection."""
    collection = db.visits
    migrated = skipped = failed = 0

    async for doc in collection.find({}, {"photo_snapshot_url": 1, "id_photo_url": 1}):
        doc_id = doc["_id"]

        for field in ("photo_snapshot_url", "id_photo_url"):
            value = doc.get(field)
            if not value:
                continue
            if is_cloudinary_url(value):
                skipped += 1
                continue
            if not extract_gridfs_id(value):
                skipped += 1
                continue

            print(f"  visits/{doc_id} → {field}")
            ok = await migrate_field(db, "visits", doc_id, field, value)
            if ok:
                migrated += 1
            else:
                failed += 1

    return migrated, skipped, failed


async def drop_gridfs_collections(db):
    """Drop GridFS chunks/files collections to free Atlas storage."""
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
    from config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        print("[ERROR] Cloudinary env vars not set. Check CLOUDINARY_CLOUD_NAME, "
              "CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.")
        sys.exit(1)

    print(f"Connecting to MongoDB: {DATABASE_NAME}")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    await client.admin.command("ping")
    print("Connected.\n")

    # ── Visitors ──────────────────────────────────────────────────────────────
    print("=== Migrating visitors collection ===")
    v_migrated, v_skipped, v_failed = await migrate_visitors(db)
    print(f"  Done: {v_migrated} migrated, {v_skipped} skipped, {v_failed} failed\n")

    # ── Visits ────────────────────────────────────────────────────────────────
    print("=== Migrating visits collection ===")
    vi_migrated, vi_skipped, vi_failed = await migrate_visits(db)
    print(f"  Done: {vi_migrated} migrated, {vi_skipped} skipped, {vi_failed} failed\n")

    total_migrated = v_migrated + vi_migrated
    total_failed = v_failed + vi_failed

    print("=" * 50)
    print(f"Total migrated: {total_migrated}")
    print(f"Total failed:   {total_failed}")
    print("=" * 50)

    if total_failed > 0:
        print("\n[WARN] Some files failed to migrate. Do NOT drop GridFS yet.")
        print("Check the errors above and re-run before dropping GridFS collections.")
        client.close()
        return

    if total_migrated == 0:
        print("\nNothing to migrate — all records already point to Cloudinary.")

    print("\nAll photos migrated successfully.")
    answer = input("\nDrop GridFS collections now to free MongoDB storage? [y/N]: ").strip().lower()
    if answer == "y":
        print("\nDropping GridFS collections...")
        await drop_gridfs_collections(db)
        print("Done. MongoDB storage has been freed.")
    else:
        print("GridFS collections kept. Re-run and choose 'y' when ready.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())

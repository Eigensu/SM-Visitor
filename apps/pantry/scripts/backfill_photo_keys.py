#!/usr/bin/env python3
"""
Convert stored photo URLs into provider-independent storage keys.

Records used to hold a full delivery URL, which is why replacing the image
host broke every photo in the system at once: the account name was baked into
a few hundred rows. New records store a key - `sm-visitor/photos/<id>` - and
the URL is built when the record is serialized. This backfills the rows
written before that change.

Run from the pantry app directory:

    cd apps/pantry

    # Report what would change. Nothing is written.
    python scripts/backfill_photo_keys.py

    # Apply it.
    python scripts/backfill_photo_keys.py --apply

Only URLs belonging to the currently configured account are converted. A URL
pointing at an account we no longer deliver from is deliberately left as it
is: turning it into a key would rebuild it against the live account and
silently claim the photo is fine, when in fact it needs re-capturing. GridFS
ids and `/uploads/...` paths are left alone for the same reason - they are not
expressible as a key.

Safe to re-run: converting an already-converted record is a no-op.
"""

import argparse
import asyncio
import os
import sys
from collections import Counter

# ── Bootstrap: add pantry root to path ───────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient

from config import CLOUDINARY_CLOUD_NAME, PHOTO_PROVIDER
from utils.photo_urls import (
    is_gridfs_id,
    is_local_buffer_path,
    is_storage_key,
    is_unreachable_photo_url,
    normalize_photo_ref,
)

MONGODB_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")

PHOTO_FIELDS = [
    ("visitors", ["photo_url", "id_card_photo_url", "id_photo_url"]),
    ("visits", ["photo_snapshot_url", "id_photo_url"]),
]


def classify(value) -> str:
    """Bucket a stored value for the report."""
    if not isinstance(value, str) or not value.strip():
        return "empty"
    if is_storage_key(value):
        return "already a key"
    if is_unreachable_photo_url(value):
        return "URL from a retired account (needs re-capture)"
    if is_gridfs_id(value):
        return "legacy GridFS id"
    if is_local_buffer_path(value):
        return "legacy local path"
    return "URL to convert"


async def collect(db) -> tuple[list[dict], Counter]:
    """Find every photo field and work out what should happen to it."""
    pending: list[dict] = []
    summary: Counter = Counter()

    for collection_name, fields in PHOTO_FIELDS:
        projection = {field: 1 for field in fields}
        async for doc in db[collection_name].find({}, projection):
            for field in fields:
                value = doc.get(field)
                bucket = classify(value)
                if bucket == "empty":
                    continue
                summary[bucket] += 1

                converted = normalize_photo_ref(value)
                if converted != value:
                    pending.append(
                        {
                            "collection": collection_name,
                            "id": doc["_id"],
                            "field": field,
                            "value": value,
                            "converted": converted,
                        }
                    )

    return pending, summary


async def apply(db, pending: list[dict]) -> tuple[int, int]:
    updated = failed = 0
    for row in pending:
        try:
            # Matching the old value as well leaves alone any record somebody
            # changed while this was running.
            result = await db[row["collection"]].update_one(
                {"_id": row["id"], row["field"]: row["value"]},
                {"$set": {row["field"]: row["converted"]}},
            )
            updated += result.matched_count
        except Exception as e:  # noqa: BLE001
            print(f"  [ERROR] {row['collection']}/{row['id']}.{row['field']}: {e}")
            failed += 1
    return updated, failed


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert stored photo URLs into provider-independent keys."
    )
    parser.add_argument(
        "--apply", action="store_true", help="Write the changes. Without it, only report."
    )
    args = parser.parse_args()

    print(f"Provider:    {PHOTO_PROVIDER}")
    print(f"Account:     {CLOUDINARY_CLOUD_NAME or '(unset)'}")
    print(f"MongoDB:     {DATABASE_NAME}")

    if not CLOUDINARY_CLOUD_NAME:
        print("\n[ERROR] CLOUDINARY_CLOUD_NAME is not set, so no URL can be recognised")
        print("        as belonging to the active account. Set it and re-run.")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    await client.admin.command("ping")

    pending, summary = await collect(db)

    print("\n=== Stored photo references ===")
    for bucket, count in sorted(summary.items(), key=lambda kv: -kv[1]):
        print(f"  {count:>5}  {bucket}")

    if not pending:
        print("\nNothing to convert - every reference is already in its final form.")
        client.close()
        return

    print(f"\n{len(pending)} field(s) would be converted, for example:")
    for row in pending[:5]:
        print(f"  {row['collection']}/{row['id']}.{row['field']}")
        print(f"    {row['value']}")
        print(f"    -> {row['converted']}")

    if not args.apply:
        print("\nDry run. Nothing was written. Re-run with --apply to convert.")
        client.close()
        return

    print(f"\n=== Converting {len(pending)} field(s) ===")
    updated, failed = await apply(db, pending)

    print(f"\n{'=' * 55}")
    print(f"Converted: {updated}")
    if failed:
        print(f"Failed:    {failed}")
    print(f"{'=' * 55}")

    client.close()

    if failed:
        sys.exit(1)

    print("\nDone. Photo references no longer name an image host, so switching")
    print("one is a change to PHOTO_PROVIDER and a copy of the files.")


if __name__ == "__main__":
    asyncio.run(main())

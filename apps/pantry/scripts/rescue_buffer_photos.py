#!/usr/bin/env python3
"""
Rescue photos stranded on the API container's local disk.

While Cloudinary is over quota its uploads fail, and PhotoStorage quietly falls
back to writing the file to the container's own disk, storing a
`/uploads/buffer/<file>` path in Mongo instead of a Cloudinary URL. The Railway
service has no volume mounted, so the next deploy or restart wipes every one of
those files and leaves the records pointing at a permanent 404.

This script fetches those files from the running API while they still exist,
uploads them to whichever Cloudinary account is configured in .env, and
rewrites the database to point at the new URLs.

Run it BEFORE changing the Cloudinary credentials on the server: saving a
variable there restarts the service and destroys the files this reads.

    cd apps/pantry

    # 1. Put the NEW Cloudinary credentials in .env, then look before leaping.
    #    Without --apply nothing is uploaded and nothing is written.
    python scripts/rescue_buffer_photos.py --source https://sm-visitor-api.eigensu.in

    # 2. Same command with --apply to upload and rewrite the database.
    python scripts/rescue_buffer_photos.py --source https://sm-visitor-api.eigensu.in --apply

Safe to re-run and safe to interrupt: every upload is checkpointed to
rescue_mapping.json before the database is touched, so a second run resumes
instead of re-uploading.
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Optional

# ── Bootstrap: add pantry root to path ───────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")
MAPPING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rescue_mapping.json")

# The two collections that store photo URLs, and the fields that hold them.
PHOTO_FIELDS = [
    ("visitors", ["photo_url", "id_card_photo_url", "id_photo_url"]),
    ("visits", ["photo_snapshot_url", "id_photo_url"]),
]

BUFFER_PREFIXES = ("/uploads/buffer/", "/uploads/photo/buffer/")

# Enough parallelism to finish before a restart catches us, low enough to stay
# polite to a single small container.
CONCURRENCY = 4


def buffer_filename(value: Optional[str]) -> Optional[str]:
    """Return the on-disk filename if this value is a local buffer path."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    for prefix in BUFFER_PREFIXES:
        if value.startswith(prefix):
            filename = value[len(prefix) :]
            # A 24-char hex id is a legacy GridFS reference served by the same
            # route, not a file on disk. Those are not at risk from a restart.
            if filename and "/" not in filename and not _is_gridfs_id(filename):
                return filename
    return None


def _is_gridfs_id(value: str) -> bool:
    return len(value) == 24 and all(c in "0123456789abcdefABCDEF" for c in value)


def load_mapping() -> dict:
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE) as f:
            return json.load(f)
    return {}


def save_mapping(mapping: dict) -> None:
    with open(MAPPING_FILE, "w") as f:
        json.dump(mapping, f, indent=2)


async def scan(db) -> tuple[list[dict], dict[str, int]]:
    """
    Find every reference to a local buffer file.

    Returns the individual references (one per document field) and a count of
    how many distinct files each collection is holding onto.
    """
    references: list[dict] = []
    per_collection: dict[str, int] = {}

    for collection_name, fields in PHOTO_FIELDS:
        seen: set[str] = set()
        projection = {field: 1 for field in fields}
        async for doc in db[collection_name].find({}, projection):
            for field in fields:
                value = doc.get(field)
                filename = buffer_filename(value)
                if not filename:
                    continue
                references.append(
                    {
                        "collection": collection_name,
                        "id": doc["_id"],
                        "field": field,
                        "value": value,
                        "filename": filename,
                    }
                )
                seen.add(filename)
        per_collection[collection_name] = len(seen)

    return references, per_collection


async def fetch(client: httpx.AsyncClient, source: str, filename: str) -> Optional[bytes]:
    """Download one buffer file from the running API."""
    url = f"{source}/uploads/buffer/{filename}"
    try:
        response = await client.get(url)
    except Exception as e:  # noqa: BLE001
        print(f"    [ERROR] {filename}: {e}")
        return None

    if response.status_code == 404:
        # Already gone - the container restarted before we got here.
        return None
    if response.status_code != 200:
        print(f"    [ERROR] {filename}: HTTP {response.status_code}")
        return None
    return response.content


async def upload(photo_data: bytes, filename: str) -> Optional[str]:
    """
    Upload to the currently configured Cloudinary account.

    Goes through the app's own storage wrapper so a rescued photo gets exactly
    the same downscaling and re-encoding as a freshly captured one, rather than
    restoring the oversized originals that caused the quota problem. Returns
    the storage key, which is what records hold.
    """
    from utils.cloudinary_storage import cloudinary_storage

    public_id = os.path.splitext(filename)[0]
    success, result = await asyncio.to_thread(
        cloudinary_storage.upload_photo, photo_data, filename, public_id
    )
    if not success:
        print(f"    [ERROR] Cloudinary upload failed for {filename}: {result}")
        return None
    return result


async def rescue_files(
    source: str, filenames: list[str], mapping: dict
) -> tuple[int, list[str], list[str]]:
    """
    Download and re-upload each file. Returns (uploaded, missing, failed).

    `mapping` collects filename -> storage key, which is what gets written back
    to the records.
    """
    uploaded = 0
    missing: list[str] = []
    failed: list[str] = []

    semaphore = asyncio.Semaphore(CONCURRENCY)
    checkpoint_lock = asyncio.Lock()
    # A wrong Cloudinary account fails on every single file. Stop at the first
    # upload failure rather than grinding through hundreds of them.
    abort = asyncio.Event()

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:

        async def rescue_one(filename: str) -> None:
            nonlocal uploaded
            if abort.is_set():
                return

            async with semaphore:
                if abort.is_set():
                    return

                photo_data = await fetch(client, source, filename)
                if photo_data is None:
                    missing.append(filename)
                    print(f"  [gone]   {filename}")
                    return

                key = await upload(photo_data, filename)
                if not key:
                    failed.append(filename)
                    abort.set()
                    return

                async with checkpoint_lock:
                    mapping[filename] = key
                    save_mapping(mapping)
                    uploaded += 1
                print(f"  [saved]  {filename} -> {key}")

        await asyncio.gather(*(rescue_one(name) for name in filenames))

    if abort.is_set():
        print("\n[ABORTED] An upload failed. Check the Cloudinary credentials in .env.")
        print("Anything already uploaded is checkpointed - re-running resumes.")

    return uploaded, missing, failed


async def apply_updates(db, references: list[dict], mapping: dict) -> tuple[int, int]:
    """Point each document field at its rescued asset's storage key."""
    updated = failed = 0

    for ref in references:
        key = mapping.get(ref["filename"])
        if not key:
            continue
        try:
            # Matching on the old value as well means a record somebody changed
            # while this was running is left alone instead of being clobbered.
            result = await db[ref["collection"]].update_one(
                {"_id": ref["id"], ref["field"]: ref["value"]},
                {"$set": {ref["field"]: key}},
            )
            if result.matched_count:
                updated += 1
            else:
                print(f"  [skip] {ref['collection']}/{ref['id']}.{ref['field']} changed underneath us")
        except Exception as e:  # noqa: BLE001
            print(f"  [ERROR] {ref['collection']}/{ref['id']}.{ref['field']}: {e}")
            failed += 1

    return updated, failed


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rescue photos stranded on the API container's local disk."
    )
    parser.add_argument(
        "--source",
        default=os.getenv("RESCUE_SOURCE_URL") or os.getenv("PANTRY_URL"),
        help="Base URL of the RUNNING API that still holds the files "
        "(e.g. https://sm-visitor-api.eigensu.in)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually upload and rewrite the database. Without it, only report.",
    )
    args = parser.parse_args()

    if not args.source:
        print("[ERROR] No --source given and neither RESCUE_SOURCE_URL nor PANTRY_URL is set.")
        print("Point it at the deployed API, which is where the files live.")
        sys.exit(1)
    source = args.source.rstrip("/")

    if "localhost" in source or "127.0.0.1" in source:
        print(f"[WARN] Source is {source}. The stranded photos live on the deployed")
        print("       container, so a local API will report them all as gone.\n")

    print(f"Source API:  {source}")
    print(f"MongoDB:     {DATABASE_NAME}")

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    await client.admin.command("ping")

    references, per_collection = await scan(db)
    distinct = sorted({ref["filename"] for ref in references})

    print("\n=== Stranded photos ===")
    for collection_name, count in per_collection.items():
        print(f"  {collection_name:<10} {count} distinct file(s)")
    print(f"  {'total':<10} {len(distinct)} distinct file(s) across {len(references)} record field(s)")

    if not distinct:
        print("\nNothing to rescue - no record points at a local buffer file.")
        client.close()
        return

    if not args.apply:
        print("\nDry run. Nothing was uploaded and nothing was written.")
        print("Re-run with --apply once the numbers above look right.")
        for name in distinct[:10]:
            print(f"  {source}/uploads/buffer/{name}")
        if len(distinct) > 10:
            print(f"  ... and {len(distinct) - 10} more")
        client.close()
        return

    from config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        print("\n[ERROR] Cloudinary credentials are not set in .env.")
        sys.exit(1)
    print(f"Cloudinary:  {CLOUDINARY_CLOUD_NAME}")

    mapping = load_mapping()
    pending = [name for name in distinct if name not in mapping]
    if len(pending) < len(distinct):
        print(f"\nResuming: {len(distinct) - len(pending)} already uploaded in a previous run.")

    print(f"\n=== Uploading {len(pending)} file(s) ===")
    uploaded, missing, failed = await rescue_files(source, pending, mapping)

    updated = update_failed = 0
    if mapping:
        print("\n=== Rewriting database ===")
        updated, update_failed = await apply_updates(db, references, mapping)

    print(f"\n{'=' * 55}")
    print(f"Uploaded to Cloudinary:  {uploaded}")
    print(f"Already gone (404):      {len(missing)}")
    print(f"Upload failures:         {len(failed)}")
    print(f"Record fields rewritten: {updated}")
    if update_failed:
        print(f"Record write failures:   {update_failed}")
    print(f"{'=' * 55}")

    if missing:
        print("\nThese files were already wiped by an earlier restart and cannot")
        print("be recovered. Their records will show the re-upload prompt:")
        for name in missing[:10]:
            print(f"  {name}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")

    client.close()

    if failed or update_failed:
        print("\nFix the errors above and re-run - completed uploads are checkpointed.")
        sys.exit(1)

    if uploaded:
        print("\nDone. It is now safe to change the Cloudinary variables on Railway.")
        if os.path.exists(MAPPING_FILE):
            os.remove(MAPPING_FILE)
            print(f"Removed checkpoint file: {MAPPING_FILE}")


if __name__ == "__main__":
    asyncio.run(main())

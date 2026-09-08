#!/usr/bin/env python3
"""
Copy photos from a previous Cloudinary account into the active one.

After an account is replaced, every record still points at the old cloud name
and none of those photos load. Once the old account is reachable again the
assets can be copied across under the same public id, which is also the
storage key records now hold.

By default the records are then pointed at a delivery URL for the new account,
because that renders on any version of the API. Run backfill_photo_keys.py
afterwards, once an API that understands storage keys is deployed, to reduce
those URLs to keys and leave nothing account-specific in the database. Passing
--repoint-as key does both at once, but only do that if the deployed API
already understands keys - it will not render them otherwise.

Cloudinary fetches each asset itself from the source URL, so the bytes never
travel through this machine. They are downscaled and re-encoded on the way in,
exactly like a freshly captured photo, rather than restoring the oversized
originals that caused the quota problem in the first place.

Run from the pantry app directory, with the ACTIVE account's credentials in
.env:

    cd apps/pantry

    # Report what would be copied. Nothing is uploaded, nothing is written.
    python scripts/migrate_cloudinary_account.py --from-cloud drsmvcisk

    # Do it. Records end up holding a URL for the new account.
    python scripts/migrate_cloudinary_account.py --from-cloud drsmvcisk --apply

    # Only when the deployed API already understands storage keys.
    python scripts/migrate_cloudinary_account.py --from-cloud drsmvcisk --apply \
        --repoint-as key

Run it while the source account is reachable - if it is suspended again
mid-run, stop and resume later: copies are checkpointed to
migration_mapping.json before any record is touched, so nothing is repeated.
"""

import argparse
import asyncio
import os
import sys
from typing import Optional

# ── Bootstrap: add pantry root to path ───────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import json

from motor.motor_asyncio import AsyncIOMotorClient

from config import (
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_UPLOAD_MAX_DIMENSION,
    CLOUDINARY_UPLOAD_QUALITY,
)
from utils.photo_urls import (
    cloudinary_cloud_name,
    storage_key_from_url,
    to_delivery_url,
)

MONGODB_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sm_visitor")
MAPPING_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "migration_mapping.json"
)

PHOTO_FIELDS = [
    ("visitors", ["photo_url", "id_card_photo_url", "id_photo_url"]),
    ("visits", ["photo_snapshot_url", "id_photo_url"]),
]

# Cloudinary is doing the fetching, so this is bounded by their side rather
# than ours. Modest, to stay well inside any rate limit on a small plan.
CONCURRENCY = 4


def load_mapping() -> dict:
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE) as f:
            return json.load(f)
    return {}


def save_mapping(mapping: dict) -> None:
    with open(MAPPING_FILE, "w") as f:
        json.dump(mapping, f, indent=2)


async def scan(db, source_cloud: str) -> tuple[list[dict], dict[str, str]]:
    """
    Find every record field pointing at the source account.

    Returns the individual references and a map of storage key -> the source
    URL to copy it from. One photo is commonly referenced by a visitor and by
    every visit that person has ever made, so the map collapses those to a
    single copy.
    """
    references: list[dict] = []
    sources: dict[str, str] = {}

    for collection_name, fields in PHOTO_FIELDS:
        projection = {field: 1 for field in fields}
        async for doc in db[collection_name].find({}, projection):
            for field in fields:
                value = doc.get(field)
                cloud = cloudinary_cloud_name(value)
                if not cloud or cloud.lower() != source_cloud.lower():
                    continue

                key = storage_key_from_url(value)
                if not key:
                    print(f"  [WARN] could not read a key from {value}")
                    continue

                references.append(
                    {
                        "collection": collection_name,
                        "id": doc["_id"],
                        "field": field,
                        "value": value,
                        "key": key,
                    }
                )
                sources.setdefault(key, value)

    return references, sources


def _configure_cloudinary() -> None:
    import cloudinary

    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )


def _is_missing_source(message: str) -> bool:
    """
    Distinguish an asset that is not in the source account from a broken run.

    A missing asset is a fact about that one photo and the other two thousand
    should still be copied. Anything else - bad credentials, a suspended
    account, a rate limit - will fail on every asset, so it stops the run.
    """
    lowered = message.lower()
    return "not found" in lowered or "404" in lowered


def _copy_one(source_url: str, key: str) -> tuple[str, Optional[str]]:
    """
    Have Cloudinary pull one asset from the old account into the new one.

    `public_id` carries the full folder path, so no `folder` argument here -
    passing both would nest the folder inside itself.

    Returns (outcome, public_id) where outcome is "copied", "missing" or
    "error".
    """
    import cloudinary.uploader

    try:
        result = cloudinary.uploader.upload(
            source_url,
            public_id=key,
            overwrite=True,
            resource_type="image",
            format="jpg",
            transformation=[
                {
                    "width": CLOUDINARY_UPLOAD_MAX_DIMENSION,
                    "height": CLOUDINARY_UPLOAD_MAX_DIMENSION,
                    "crop": "limit",
                    "quality": CLOUDINARY_UPLOAD_QUALITY,
                }
            ],
        )
    except Exception as e:  # noqa: BLE001
        if _is_missing_source(str(e)):
            return "missing", None
        print(f"    [ERROR] {key}: {e}")
        return "error", None

    landed = result.get("public_id")
    if landed != key:
        # The records are about to be pointed at `key`. If the asset landed
        # anywhere else they would resolve to nothing.
        print(f"    [ERROR] {key}: asset landed at {landed!r} instead")
        return "error", None
    return "copied", landed


async def copy_assets(
    sources: dict[str, str], mapping: dict
) -> tuple[int, list[str], list[str]]:
    """
    Copy each distinct asset across. Returns (copied, missing keys, failed keys).

    An asset the source account does not have is skipped and recorded: that is
    a fact about one photo, and the rest still need copying. A different kind
    of failure stops the run, because it will repeat on every remaining asset.
    """
    copied = 0
    missing: list[str] = []
    failed: list[str] = []
    total = len(sources)

    semaphore = asyncio.Semaphore(CONCURRENCY)
    checkpoint_lock = asyncio.Lock()
    abort = asyncio.Event()

    async def copy_one(key: str, source_url: str) -> None:
        nonlocal copied
        if abort.is_set():
            return
        async with semaphore:
            if abort.is_set():
                return

            outcome, landed = await asyncio.to_thread(_copy_one, source_url, key)

            if outcome == "missing":
                async with checkpoint_lock:
                    missing.append(key)
                print(f"  [gone]   {key}")
                return

            if outcome != "copied":
                failed.append(key)
                abort.set()
                return

            async with checkpoint_lock:
                mapping[key] = landed
                save_mapping(mapping)
                copied += 1
                done = copied + len(missing)
            print(f"  [copied] {done}/{total}  {key}")

    await asyncio.gather(*(copy_one(k, url) for k, url in sources.items()))

    if abort.is_set():
        print("\n[ABORTED] A copy failed for a reason other than a missing asset -")
        print("the source account may have been suspended again, or the credentials")
        print("in .env are not the destination account. Copies already made are")
        print("checkpointed, so re-running resumes.")

    return copied, missing, failed


async def repoint(
    db, references: list[dict], mapping: dict, as_url: bool
) -> tuple[int, int]:
    """
    Point each record at the copy that now lives in the active account.

    `as_url` writes a full delivery URL; otherwise the bare storage key. The
    key is the better thing to store, but only an API that knows how to build
    a URL from one can render it, so writing URLs is what lets this run before
    that API is deployed. `backfill_photo_keys.py` converts them afterwards.
    """
    updated = failed = 0

    for ref in references:
        if ref["key"] not in mapping:
            continue
        new_value = to_delivery_url(ref["key"]) if as_url else ref["key"]
        try:
            # Matching the old value as well leaves alone anything somebody
            # changed while this was running - a guard re-capturing a photo,
            # for instance.
            result = await db[ref["collection"]].update_one(
                {"_id": ref["id"], ref["field"]: ref["value"]},
                {"$set": {ref["field"]: new_value}},
            )
            updated += result.matched_count
        except Exception as e:  # noqa: BLE001
            print(f"  [ERROR] {ref['collection']}/{ref['id']}.{ref['field']}: {e}")
            failed += 1

    return updated, failed


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy photos from a previous Cloudinary account into the active one."
    )
    parser.add_argument(
        "--from-cloud",
        required=True,
        help="Cloud name of the account to copy FROM (e.g. drsmvcisk). "
        "It must be reachable - assets are fetched from its delivery URLs.",
    )
    parser.add_argument(
        "--apply", action="store_true", help="Copy and repoint. Without it, only report."
    )
    parser.add_argument(
        "--repoint-as",
        choices=("url", "key"),
        default="url",
        help="What to write on the records. 'url' (default) is readable by any "
        "version of the API, so it is safe to run before deploying one that "
        "understands keys. 'key' is the end state, reached either by this flag "
        "or by running backfill_photo_keys.py later.",
    )
    args = parser.parse_args()

    source_cloud = args.from_cloud.strip()
    if source_cloud.lower() == (CLOUDINARY_CLOUD_NAME or "").lower():
        print(f"[ERROR] --from-cloud is the active account ({CLOUDINARY_CLOUD_NAME}).")
        print("        Nothing to copy.")
        sys.exit(1)
    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        print("[ERROR] The destination account's credentials are not set in .env.")
        sys.exit(1)

    print(f"Copying from: {source_cloud}")
    print(f"Copying to:   {CLOUDINARY_CLOUD_NAME}")
    print(f"MongoDB:      {DATABASE_NAME}")

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    await client.admin.command("ping")

    references, sources = await scan(db, source_cloud)

    print("\n=== Photos on the old account ===")
    print(f"  {len(sources)} distinct photo(s)")
    print(f"  {len(references)} record field(s) referencing them")

    if not sources:
        print(f"\nNothing found for cloud name {source_cloud!r}.")
        print("Check the name against a stored URL - it is the segment right")
        print("after res.cloudinary.com/.")
        client.close()
        return

    if not args.apply:
        print("\nDry run. Nothing was copied and nothing was written.")
        print("Re-run with --apply once the numbers above look right.\n")
        for key in list(sources)[:5]:
            print(f"  {key}")
        if len(sources) > 5:
            print(f"  ... and {len(sources) - 5} more")
        client.close()
        return

    mapping = load_mapping()
    pending = {k: v for k, v in sources.items() if k not in mapping}
    if len(pending) < len(sources):
        print(f"\nResuming: {len(sources) - len(pending)} already copied.")

    _configure_cloudinary()

    print(f"\n=== Copying {len(pending)} photo(s) ===")
    copied, missing, failed = await copy_assets(pending, mapping)

    updated = update_failed = 0
    if mapping:
        print("\n=== Repointing records ===")
        updated, update_failed = await repoint(
            db, references, mapping, as_url=args.repoint_as == "url"
        )

    print(f"\n{'=' * 55}")
    print(f"Photos copied:           {copied}")
    print(f"Not in the old account:  {len(missing)}")
    print(f"Copy failures:           {len(failed)}")
    print(f"Record fields repointed: {updated}")
    if update_failed:
        print(f"Record write failures:   {update_failed}")
    print(f"{'=' * 55}")

    if missing:
        print(f"\n{len(missing)} photo(s) are not in {source_cloud} at all, so there is")
        print("nothing to copy. Their records keep the old URL and will show the")
        print("re-upload prompt in the apps:")
        for key in missing[:10]:
            print(f"  {key}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")

    client.close()

    if failed or update_failed:
        print("\nRe-run to pick up where this stopped.")
        sys.exit(1)

    if copied:
        if args.repoint_as == "url":
            print(f"\nDone. The records copied above now hold a {CLOUDINARY_CLOUD_NAME}")
            print("URL, which every version of the API can render. Run")
            print("backfill_photo_keys.py --apply once an API that understands storage")
            print("keys is deployed, to drop the account name back out of the database.")
        else:
            print("\nDone. The records copied above now hold a plain storage key and")
            print(f"resolve against {CLOUDINARY_CLOUD_NAME}.")
        if missing:
            print(f"{source_cloud} is still referenced by the records whose photo it")
            print("does not have; those need a fresh capture through the apps.")
        if os.path.exists(MAPPING_FILE):
            os.remove(MAPPING_FILE)
            print(f"Removed checkpoint file: {MAPPING_FILE}")


if __name__ == "__main__":
    asyncio.run(main())

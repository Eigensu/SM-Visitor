"""
Reasoning about the photo references stored on visitor and visit records.

Records store a provider-independent storage key - `sm-visitor/photos/<id>` -
rather than a full delivery URL. The URL is built when a record is serialized,
from whichever host is configured. That is what makes moving to another image
host a configuration change plus a copy of the files, instead of a rewrite of
every row in the database: the mistake that turned a Cloudinary account switch
into a week of recovery work.

Three legacy shapes still appear in stored records and are passed through
untouched, because none can be expressed as a key for the active provider:

  * full Cloudinary URLs, including ones pointing at an account we no longer
    deliver from, which still need to be recognised as unreachable
  * 24-character hex GridFS ids from before the Cloudinary migration
  * `/uploads/buffer/...` paths from when a failed upload was written to the
    API container's local disk

Both conversions are idempotent: a key stays a key, a URL stays a URL. That
means they can be applied at any layer without having to track whether some
caller upstream already applied them.
"""

import re
from typing import Optional

from config import (
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_RETIRED_CLOUD_NAMES,
    PHOTO_PROVIDER,
)

_CLOUDINARY_URL_RE = re.compile(
    r"^https?://res\.cloudinary\.com/(?P<cloud>[^/]+)/", re.IGNORECASE
)
# Present in every delivery URL, and where the key begins when parsing one.
_CLOUDINARY_UPLOAD_MARKER = "/upload/"
# The resource type sits between the cloud name and the marker when building.
_CLOUDINARY_DELIVERY_PATH = "/image/upload/"

_GRIDFS_ID_RE = re.compile(r"^[a-f0-9]{24}$", re.IGNORECASE)
_VERSION_SEGMENT_RE = re.compile(r"^v\d+$")
# A Cloudinary transformation segment is a comma-separated list of short
# `key_value` pairs, e.g. `c_limit,w_256,q_auto`.
_TRANSFORM_SEGMENT_RE = re.compile(r"^[a-z]{1,3}_[^/]*$")


def is_http_url(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.strip().lower().startswith(("http://", "https://"))


def is_gridfs_id(value: Optional[str]) -> bool:
    return isinstance(value, str) and bool(_GRIDFS_ID_RE.match(value.strip()))


def is_local_buffer_path(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.strip().startswith("/uploads/")


def is_storage_key(value: Optional[str]) -> bool:
    """
    True for the provider-independent form we store on new records.

    Everything that is not a URL, a GridFS id or a local path is a key.
    """
    if not isinstance(value, str) or not value.strip():
        return False
    value = value.strip()
    return not (is_http_url(value) or is_gridfs_id(value) or is_local_buffer_path(value))


def cloudinary_cloud_name(photo_url: Optional[str]) -> Optional[str]:
    """Return the cloud name embedded in a Cloudinary delivery URL, if any."""
    if not photo_url or not isinstance(photo_url, str):
        return None
    match = _CLOUDINARY_URL_RE.match(photo_url.strip())
    return match.group("cloud") if match else None


def storage_key_from_url(photo_url: Optional[str]) -> Optional[str]:
    """
    Pull the storage key out of a Cloudinary delivery URL.

    Strips the transformation and version segments that may sit between
    `/upload/` and the public id, plus the file extension, leaving the folder
    path and public id that identify the asset with any provider.
    """
    if not cloudinary_cloud_name(photo_url):
        return None

    url = photo_url.strip().split("?", 1)[0]
    marker_at = url.find(_CLOUDINARY_UPLOAD_MARKER)
    if marker_at == -1:
        return None

    segments = url[marker_at + len(_CLOUDINARY_UPLOAD_MARKER) :].split("/")
    while segments and (
        _VERSION_SEGMENT_RE.match(segments[0]) or _TRANSFORM_SEGMENT_RE.match(segments[0])
    ):
        segments.pop(0)

    if not segments:
        return None

    key = "/".join(segments)
    # Cloudinary serves a public id with no extension in its stored format, so
    # dropping it here keeps the key honest about identity rather than encoding
    # a format the next provider may not use.
    return key.rsplit(".", 1)[0] or None


def normalize_photo_ref(value: Optional[str]) -> Optional[str]:
    """
    Reduce a photo reference to what should be persisted.

    A delivery URL from the active provider becomes a key. Anything else - a
    key already, a legacy shape, a URL from a retired account - is kept as it
    is, since rewriting those would either lose information or claim an asset
    exists where it does not.
    """
    if not isinstance(value, str) or not value.strip():
        return value

    value = value.strip()
    if is_unreachable_photo_url(value):
        # Turning a dead URL into a key would rebuild it against the live
        # account and quietly assert the photo is fine. Leave it visibly broken
        # so it keeps being reported as needing a new photo.
        return value

    return storage_key_from_url(value) or value


def to_delivery_url(value: Optional[str]) -> Optional[str]:
    """
    Build the URL a browser should load for a stored reference.

    Legacy shapes are returned untouched: the apps already know how to resolve
    a GridFS id via a signed URL, and a `/uploads/...` path against the API.
    """
    if not isinstance(value, str) or not value.strip():
        return value

    value = value.strip()
    if not is_storage_key(value):
        return value

    if PHOTO_PROVIDER == "cloudinary":
        if not CLOUDINARY_CLOUD_NAME:
            return value
        return (
            f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}"
            f"{_CLOUDINARY_DELIVERY_PATH}{value}"
        )

    # config.py rejects an unsupported provider at boot, so this is only
    # reachable if a provider is added there without a builder here.
    raise RuntimeError(f"No delivery URL builder for PHOTO_PROVIDER={PHOTO_PROVIDER!r}")


def is_unreachable_photo_url(photo_url: Optional[str]) -> bool:
    """
    True when a URL points at a Cloudinary cloud we no longer deliver from.

    A cloud name listed in CLOUDINARY_RETIRED_CLOUD_NAMES always counts.
    Otherwise any cloud name that differs from the configured active one
    counts - that is exactly the state of every record after switching
    accounts. Keys are never unreachable by this test: they are built against
    whichever account is live, so a missing asset surfaces as a failed image
    load in the apps instead.
    """
    cloud = cloudinary_cloud_name(photo_url)
    if not cloud:
        return False
    if cloud.lower() in CLOUDINARY_RETIRED_CLOUD_NAMES:
        return True
    if not CLOUDINARY_CLOUD_NAME:
        return False
    return cloud.lower() != CLOUDINARY_CLOUD_NAME.lower()

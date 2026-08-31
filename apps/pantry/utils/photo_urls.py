"""
Helpers for reasoning about stored photo URLs.

When a Cloudinary account is replaced - or suspended for exceeding its plan
quota - every URL written against the old cloud name stops resolving. Those
records cannot be repaired from our side: the original bytes only ever lived
in the old account, so the photo has to be captured again.

The API therefore flags such records instead of letting the apps render a
broken image, and the apps offer a re-upload action in their place.
"""

import re
from typing import Optional

from config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_RETIRED_CLOUD_NAMES

_CLOUDINARY_URL_RE = re.compile(
    r"^https?://res\.cloudinary\.com/(?P<cloud>[^/]+)/", re.IGNORECASE
)


def cloudinary_cloud_name(photo_url: Optional[str]) -> Optional[str]:
    """Return the cloud name embedded in a Cloudinary delivery URL, if any."""
    if not photo_url or not isinstance(photo_url, str):
        return None
    match = _CLOUDINARY_URL_RE.match(photo_url.strip())
    return match.group("cloud") if match else None


def is_unreachable_photo_url(photo_url: Optional[str]) -> bool:
    """
    True when a URL points at a Cloudinary cloud we no longer deliver from.

    A cloud name listed in CLOUDINARY_RETIRED_CLOUD_NAMES always counts.
    Otherwise any cloud name that differs from the configured active one
    counts - that is exactly the state of every record after switching
    accounts. With CLOUDINARY_CLOUD_NAME unset we cannot tell, so the URL is
    treated as fine and the browser's own load error is the fallback signal.
    """
    cloud = cloudinary_cloud_name(photo_url)
    if not cloud:
        return False
    if cloud.lower() in CLOUDINARY_RETIRED_CLOUD_NAMES:
        return True
    if not CLOUDINARY_CLOUD_NAME:
        return False
    return cloud.lower() != CLOUDINARY_CLOUD_NAME.lower()

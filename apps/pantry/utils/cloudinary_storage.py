"""
Cloudinary storage utility for uploading visitor photos.

This module wraps the `cloudinary` SDK and exposes a simple interface
that `PhotoStorage` can use.
"""

import io
from typing import Tuple

import cloudinary
import cloudinary.uploader

from config import (
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_FOLDER,
)


class CloudinaryStorage:
    """
    Thin wrapper around Cloudinary's upload API.
    Returns (success, url_or_error_message).
    """

    def __init__(self) -> None:
        # Configure Cloudinary from env vars
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True,
        )

    def _is_configured(self) -> Tuple[bool, str]:
        if not CLOUDINARY_CLOUD_NAME:
            return False, "CLOUDINARY_CLOUD_NAME is not set"
        if not CLOUDINARY_API_KEY:
            return False, "CLOUDINARY_API_KEY is not set"
        if not CLOUDINARY_API_SECRET:
            return False, "CLOUDINARY_API_SECRET is not set"
        return True, ""

    def upload_photo(self, photo_data: bytes, filename: str) -> Tuple[bool, str]:
        """
        Upload a photo to Cloudinary.

        Args:
            photo_data: Raw image bytes
            filename: Original filename (used for public_id base)

        Returns:
            (True, secure_url) on success
            (False, error_message) on failure
        """
        configured, error = self._is_configured()
        if not configured:
            return False, error

        try:
            # Use a BytesIO wrapper so Cloudinary can read the bytes
            file_obj = io.BytesIO(photo_data)

            # Derive a base public_id from the filename (extension stripped)
            public_id_base = filename.rsplit(".", 1)[0]

            upload_result = cloudinary.uploader.upload(
                file_obj,
                folder=CLOUDINARY_FOLDER,
                public_id=public_id_base,
                overwrite=True,
                resource_type="image",
            )

            secure_url = upload_result.get("secure_url")
            if not secure_url:
                return False, "Cloudinary upload did not return a secure_url"

            return True, secure_url
        except Exception as e:  # noqa: BLE001
            # Return error so caller can decide fallback behavior
            return False, f"Cloudinary upload failed: {e}"


# Global instance used by the rest of the app
cloudinary_storage = CloudinaryStorage()


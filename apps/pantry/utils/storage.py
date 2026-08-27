"""
Photo storage utility - uploads to Cloudinary for permanent storage.
GridFS read methods are kept for the migration script and backward compat.
"""
import asyncio
import io
import os
import uuid

from config import LOCAL_STORAGE_PATH


class PhotoStorage:
    """Handles photo storage via Cloudinary. GridFS reads kept for migration."""

    def __init__(self):
        self.local_buffer_path = os.path.join(LOCAL_STORAGE_PATH, "buffer")
        os.makedirs(self.local_buffer_path, exist_ok=True)

    async def _upload_to_cloudinary(self, photo_data: bytes, filename: str) -> str:
        """Upload bytes to Cloudinary and return the secure URL. Fallback to local."""
        from utils.cloudinary_storage import cloudinary_storage
        unique_id = f"{uuid.uuid4().hex}_{os.path.splitext(filename)[0]}"
        success, result = await asyncio.to_thread(
            cloudinary_storage.upload_photo, photo_data, f"{unique_id}.jpg", unique_id
        )
        if not success:
            print(f"Cloudinary upload failed ({result}), falling back to local storage")
            local_filename = f"{unique_id}.jpg"
            # Fallback writes to the local buffer directory. The returned URL
            # is automatically served by the GET /uploads/buffer/{filename} endpoint.
            full_path = os.path.join(self.local_buffer_path, local_filename)
            with open(full_path, "wb") as f:
                f.write(photo_data)
            return f"/uploads/buffer/{local_filename}"
        return result

    async def save_regular_visitor_photo(self, photo_data: bytes, filename: str) -> str:
        """Upload regular visitor photo to Cloudinary. Returns Cloudinary URL."""
        return await self._upload_to_cloudinary(photo_data, filename)

    async def save_new_visitor_photo_buffer(self, photo_data: bytes, filename: str) -> str:
        """Upload new visitor/buffer photo to Cloudinary. Returns Cloudinary URL."""
        return await self._upload_to_cloudinary(photo_data, filename)

    # ── Backward-compat GridFS reads (used by migration script) ──────────────

    async def get_regular_visitor_photo(self, file_id: str) -> bytes | None:
        """Download photo from GridFS visitor_photos bucket."""
        try:
            from bson import ObjectId
            from database import get_database
            from motor.motor_asyncio import AsyncIOMotorGridFSBucket
            db = get_database()
            fs = AsyncIOMotorGridFSBucket(db, bucket_name="visitor_photos")
            grid_out = await fs.open_download_stream(ObjectId(file_id))
            return await grid_out.read()
        except Exception as e:
            print(f"[GridFS] Error retrieving visitor_photos/{file_id}: {e}")
            return None

    async def get_gridfs_buffer_photo(self, file_id: str) -> bytes | None:
        """Download photo from GridFS visitor_photos_buffer bucket."""
        try:
            from bson import ObjectId
            from database import get_database
            from motor.motor_asyncio import AsyncIOMotorGridFSBucket
            db = get_database()
            fs = AsyncIOMotorGridFSBucket(db, bucket_name="visitor_photos_buffer")
            grid_out = await fs.open_download_stream(ObjectId(file_id))
            return await grid_out.read()
        except Exception as e:
            print(f"[GridFS] Error retrieving visitor_photos_buffer/{file_id}: {e}")
            return None

    def get_new_visitor_photo_buffer(self, filename: str) -> bytes | None:
        """Local filesystem buffer read (legacy fallback only)."""
        try:
            full_path = os.path.join(self.local_buffer_path, filename)
            if os.path.exists(full_path):
                with open(full_path, "rb") as f:
                    return f.read()
            return None
        except Exception as e:
            print(f"Error reading local buffer photo: {e}")
            return None

    def delete_buffer_photo(self, filename: str) -> bool:
        try:
            full_path = os.path.join(self.local_buffer_path, filename)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception as e:
            print(f"Error deleting buffer photo: {e}")
            return False

    async def delete_regular_visitor_photo(self, file_id_or_url: str) -> bool:
        """Delete from Cloudinary (URL) or GridFS (24-char hex ID)."""
        if file_id_or_url.startswith("http"):
            try:
                import cloudinary.uploader
                parts = file_id_or_url.split("/upload/")
                if len(parts) == 2:
                    segment = parts[1]
                    if "/" in segment and segment.split("/")[0].startswith("v"):
                        segment = segment.split("/", 1)[1]
                    public_id = segment.rsplit(".", 1)[0]
                    await asyncio.to_thread(cloudinary.uploader.destroy, public_id)
                return True
            except Exception as e:
                print(f"Error deleting Cloudinary photo: {e}")
                return False
        elif file_id_or_url.startswith("/uploads/buffer/"):
            filename = file_id_or_url.split("/")[-1]
            return self.delete_buffer_photo(filename)
        else:
            try:
                from bson import ObjectId
                from database import get_database
                from motor.motor_asyncio import AsyncIOMotorGridFSBucket
                db = get_database()
                fs = AsyncIOMotorGridFSBucket(db, bucket_name="visitor_photos")
                await fs.delete(ObjectId(file_id_or_url))
                return True
            except Exception as e:
                print(f"Error deleting GridFS photo: {e}")
                return False

    def _get_content_type(self, filename: str) -> str:
        ext = os.path.splitext(filename)[1].lower()
        return {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(
            ext, "application/octet-stream"
        )

    async def validate_photo(self, photo_data: bytes, max_size_mb: int = 5) -> tuple[bool, str]:
        size_mb = len(photo_data) / (1024 * 1024)
        if size_mb > max_size_mb:
            return False, f"Photo size exceeds {max_size_mb}MB limit"

        def verify_image():
            try:
                from PIL import Image
                img = Image.open(io.BytesIO(photo_data))
                img.verify()
                if img.format not in ["JPEG", "PNG"]:
                    return False, "Only JPEG and PNG formats are supported"
                return True, ""
            except Exception as e:
                return False, f"Invalid image file: {e!s}"

        return await asyncio.to_thread(verify_image)


photo_storage = PhotoStorage()

"""
Photo storage utility supporting MongoDB GridFS for regular visitors
and local buffer storage for new visitors
"""
import os
import io
from typing import Optional, BinaryIO
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from database import get_database
from config import LOCAL_STORAGE_PATH
import uuid


class PhotoStorage:
    """
    Handles photo storage with two strategies:
    - Regular visitors: MongoDB GridFS (permanent storage)
    - New visitors: Local buffer (temporary storage)
    """
    
    def __init__(self):
        self.local_buffer_path = os.path.join(LOCAL_STORAGE_PATH, "buffer")
        os.makedirs(self.local_buffer_path, exist_ok=True)
    
    async def save_regular_visitor_photo(self, photo_data: bytes, filename: str) -> str:
        """
        Save regular visitor photo to MongoDB GridFS
        
        Args:
            photo_data: Photo binary data
            filename: Original filename
        
        Returns:
            GridFS file ID as string
        """
        db = get_database()
        fs = AsyncIOMotorGridFSBucket(db, bucket_name="visitor_photos")
        
        # Create metadata
        metadata = {
            "uploaded_at": datetime.utcnow(),
            "original_filename": filename,
            "content_type": self._get_content_type(filename)
        }
        
        # Upload to GridFS
        file_id = await fs.upload_from_stream(
            filename,
            io.BytesIO(photo_data),
            metadata=metadata
        )
        
        return str(file_id)
    
    async def get_regular_visitor_photo(self, file_id: str) -> Optional[bytes]:
        """
        Retrieve regular visitor photo from MongoDB GridFS
        
        Args:
            file_id: GridFS file ID
        
        Returns:
            Photo binary data or None
        """
        try:
            from bson import ObjectId
            db = get_database()
            fs = AsyncIOMotorGridFSBucket(db, bucket_name="visitor_photos")
            
            # Download from GridFS
            grid_out = await fs.open_download_stream(ObjectId(file_id))
            photo_data = await grid_out.read()
            
            return photo_data
        except Exception as e:
            print(f"Error retrieving photo: {e}")
            return None
    
    def save_new_visitor_photo_buffer(self, photo_data: bytes, filename: str) -> str:
        """
        Save new visitor photo to local buffer (temporary storage)
        
        Args:
            photo_data: Photo binary data
            filename: Original filename
        
        Returns:
            Local file path
        """
        # Generate unique filename
        ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(self.local_buffer_path, unique_filename)
        
        # Save to local buffer
        with open(filepath, 'wb') as f:
            f.write(photo_data)
        
        return filepath
    
    def get_new_visitor_photo_buffer(self, filepath: str) -> Optional[bytes]:
        """
        Retrieve new visitor photo from local buffer
        
        Args:
            filepath: Local file path
        
        Returns:
            Photo binary data or None
        """
        try:
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    return f.read()
            return None
        except Exception as e:
            print(f"Error reading buffer photo: {e}")
            return None
    
    def delete_buffer_photo(self, filepath: str) -> bool:
        """
        Delete photo from local buffer
        
        Args:
            filepath: Local file path
        
        Returns:
            True if deleted successfully
        """
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                return True
            return False
        except Exception as e:
            print(f"Error deleting buffer photo: {e}")
            return False
    
    async def delete_regular_visitor_photo(self, file_id: str) -> bool:
        """
        Delete regular visitor photo from GridFS
        
        Args:
            file_id: GridFS file ID
        
        Returns:
            True if deleted successfully
        """
        try:
            from bson import ObjectId
            db = get_database()
            fs = AsyncIOMotorGridFSBucket(db, bucket_name="visitor_photos")
            
            await fs.delete(ObjectId(file_id))
            return True
        except Exception as e:
            print(f"Error deleting GridFS photo: {e}")
            return False
    
    def _get_content_type(self, filename: str) -> str:
        """Get content type from filename extension"""
        ext = os.path.splitext(filename)[1].lower()
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
        }
        return content_types.get(ext, 'application/octet-stream')
    
    def validate_photo(self, photo_data: bytes, max_size_mb: int = 5) -> tuple[bool, str]:
        """
        Validate photo data
        
        Args:
            photo_data: Photo binary data
            max_size_mb: Maximum size in MB
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check size
        size_mb = len(photo_data) / (1024 * 1024)
        if size_mb > max_size_mb:
            return False, f"Photo size exceeds {max_size_mb}MB limit"
        
        # Check if it's a valid image using Pillow
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(photo_data))
            img.verify()
            
            # Check format
            if img.format not in ['JPEG', 'PNG']:
                return False, "Only JPEG and PNG formats are supported"
            
            return True, ""
        except Exception as e:
            return False, f"Invalid image file: {str(e)}"


# Global instance
photo_storage = PhotoStorage()

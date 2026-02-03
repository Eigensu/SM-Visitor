"""
Photo Upload Router - Handle photo uploads with validation
Saves regular visitor photos to GridFS and new visitor photos to local buffer
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from middleware.auth import get_current_guard
from utils.storage import photo_storage


router = APIRouter(prefix="/uploads", tags=["Uploads"])


class PhotoUploadResponse(BaseModel):
    photo_url: str
    storage_type: str
    message: str


@router.post("/photo/regular", response_model=PhotoUploadResponse)
async def upload_regular_visitor_photo(
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_guard)
):
    """
    Upload photo for regular visitor (saved to MongoDB GridFS)
    
    - **photo**: Image file (JPEG/PNG, max 5MB)
    
    Returns GridFS file ID for permanent storage
    """
    # Read photo data
    photo_data = await photo.read()
    
    # Validate photo
    is_valid, error_msg = photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Save to GridFS
    file_id = await photo_storage.save_regular_visitor_photo(
        photo_data,
        photo.filename or "visitor_photo.jpg"
    )
    
    return PhotoUploadResponse(
        photo_url=file_id,
        storage_type="gridfs",
        message="Photo saved to MongoDB GridFS"
    )


@router.post("/photo/new-visitor", response_model=PhotoUploadResponse)
async def upload_new_visitor_photo(
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_guard)
):
    """
    Upload photo for new visitor (saved to Cloudinary cloud storage)
    
    - **photo**: Image file (JPEG/PNG, max 5MB)
    
    Returns Cloudinary secure URL for cloud storage
    """
    # Read photo data
    photo_data = await photo.read()
    
    # Validate photo
    is_valid, error_msg = photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Save to Cloudinary (with local buffer fallback)
    photo_url = await photo_storage.save_new_visitor_photo_buffer(
        photo_data,
        photo.filename or "new_visitor_photo.jpg"
    )
    
    # Determine storage type based on URL
    storage_type = "cloudinary" if photo_url.startswith("http") else "local_buffer"
    message = "Photo saved to Cloudinary" if storage_type == "cloudinary" else "Photo saved to local buffer (Cloudinary unavailable)"
    
    return PhotoUploadResponse(
        photo_url=photo_url,
        storage_type=storage_type,
        message=message
    )


@router.get("/photo/regular/{file_id}")
async def get_regular_visitor_photo(
    file_id: str,
    current_user: dict = Depends(get_current_guard)
):
    """
    Retrieve regular visitor photo from GridFS
    
    Returns the image file
    """
    from fastapi.responses import Response
    
    photo_data = await photo_storage.get_regular_visitor_photo(file_id)
    
    if not photo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )
    
    return Response(
        content=photo_data,
        media_type="image/jpeg"
    )


@router.get("/photo/buffer/{filename}")
async def get_buffer_photo(
    filename: str,
    current_user: dict = Depends(get_current_guard)
):
    """
    Retrieve new visitor photo from local buffer
    
    Returns the image file
    """
    from fastapi.responses import Response
    import os
    from config import LOCAL_STORAGE_PATH
    
    filepath = os.path.join(LOCAL_STORAGE_PATH, "buffer", filename)
    photo_data = photo_storage.get_new_visitor_photo_buffer(filepath)
    
    if not photo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found in buffer"
        )
    
    return Response(
        content=photo_data,
        media_type="image/jpeg"
    )

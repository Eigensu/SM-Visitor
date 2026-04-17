"""
Photo Upload Router - Handle photo uploads with validation
Saves regular visitor photos to GridFS and new visitor photos to local buffer
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from middleware.auth import get_current_guard, get_current_user
from utils.storage import photo_storage


router = APIRouter(prefix="/uploads", tags=["Uploads"])


class PhotoUploadResponse(BaseModel):
    photo_url: str
    storage_type: str
    message: str


@router.post("/photo/regular", response_model=PhotoUploadResponse)
@router.post("/photo/regular-visitor", response_model=PhotoUploadResponse)
async def upload_regular_visitor_photo(
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_guard),
):
    """
    Upload photo for regular visitor (saved to MongoDB GridFS)

    - **photo**: Image file (JPEG/PNG, max 5MB)

    Returns GridFS file ID for permanent storage
    """
    # Read photo data
    photo_data = await photo.read()
    
    # Validate photo
    is_valid, error_msg = await photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # Save to GridFS
    file_id = await photo_storage.save_regular_visitor_photo(
        photo_data,
        photo.filename or "visitor_photo.jpg",
    )

    return PhotoUploadResponse(
        photo_url=f"/uploads/photo/regular/{file_id}",
        storage_type="gridfs",
        message="Photo saved to MongoDB GridFS",
    )


@router.post("/photo/new-visitor", response_model=PhotoUploadResponse)
async def upload_new_visitor_photo(
    photo: UploadFile = File(...), current_user: dict = Depends(get_current_guard)
):
    """
    Upload photo for new visitor (saved to Cloudinary cloud storage)

    - **photo**: Image file (JPEG/PNG, max 5MB)

    Returns Cloudinary secure URL for cloud storage
    """
    # Read photo data
    photo_data = await photo.read()
    
    # Validate photo
    is_valid, error_msg = await photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Save to local buffer
    filename = await photo_storage.save_new_visitor_photo_buffer(
        photo_data,
        photo.filename or "new_visitor_photo.jpg"
    )

    return PhotoUploadResponse(
        photo_url=f"/uploads/photo/buffer/{filename}",
        storage_type="local_buffer",
        message="Photo saved to local buffer temporarily"
    )


@router.get("/photo/regular/{file_id}")
@router.get("/regular/{file_id}")
async def get_regular_visitor_photo(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve regular visitor photo from GridFS

    Returns the image file
    """
    from fastapi.responses import Response

    photo_data = await photo_storage.get_regular_visitor_photo(file_id)

    if not photo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    return Response(content=photo_data, media_type="image/jpeg")


@router.get("/photo/buffer/{filename}")
@router.get("/buffer/{filename}")
async def get_buffer_photo(
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve new visitor photo from local buffer

    Returns the image file
    """
    from fastapi.responses import Response
    
    photo_data = photo_storage.get_new_visitor_photo_buffer(filename)
    
    if not photo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found in buffer"
        )

    return Response(content=photo_data, media_type="image/jpeg")


@router.post("/photo/id-card", response_model=PhotoUploadResponse)
async def upload_id_card_photo(
    photo: UploadFile = File(...), current_user: dict = Depends(get_current_guard)
):
    """
    Upload ID card photo (Aadhar/PAN) to Cloudinary
    """
    photo_data = await photo.read()

    is_valid, error_msg = photo_storage.validate_photo(photo_data, max_size_mb=10)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    photo_url = await photo_storage.save_new_visitor_photo_buffer(
        photo_data, photo.filename or "id_card_photo.jpg"
    )

    storage_type = "cloudinary" if photo_url.startswith("http") else "local_buffer"
    return PhotoUploadResponse(
        photo_url=photo_url, storage_type=storage_type, message="ID card photo uploaded"
    )

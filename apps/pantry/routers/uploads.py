"""
Photo Upload Router - Handle photo uploads with validation
Saves regular visitor photos to GridFS and new visitor photos to local buffer
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Request
from pydantic import BaseModel

from middleware.auth import get_current_guard
from utils.storage import photo_storage
from config import PANTRY_URL, PHOTO_SIGNING_SECRET
import hmac
import hashlib
from datetime import datetime


router = APIRouter(prefix="/uploads", tags=["Uploads"])


class PhotoUploadResponse(BaseModel):
    photo_url: str
    storage_type: str
    message: str


@router.post("/photo/regular", response_model=PhotoUploadResponse)
@router.post("/photo/regular-visitor", response_model=PhotoUploadResponse)
async def upload_regular_visitor_photo(
    photo: UploadFile = File(...),
    _current_user: dict = Depends(get_current_guard),
):
    """
    Upload photo for regular visitor (saved to MongoDB GridFS)

    - **photo**: Image file (JPEG/PNG, max 5MB)

    Returns GridFS file ID for permanent storage
    """
    # Basic content type whitelist to reject non-image uploads early
    if photo.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG and PNG images are allowed")

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
    photo: UploadFile = File(...), _current_user: dict = Depends(get_current_guard)
):
    """
    Upload photo for new visitor (saved to Cloudinary cloud storage)

    - **photo**: Image file (JPEG/PNG, max 5MB)

    Returns Cloudinary secure URL for cloud storage
    """
    # Basic content type whitelist to reject non-image uploads early
    if photo.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG and PNG images are allowed")

    # Read photo data
    photo_data = await photo.read()
    
    # Validate photo
    is_valid, error_msg = await photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Save to deployment-safe temporary GridFS buffer and return its id
    file_id = await photo_storage.save_new_visitor_photo_buffer(
        photo_data,
        photo.filename or "new_visitor_photo.jpg",
    )

    return PhotoUploadResponse(
        photo_url=f"/uploads/photo/buffer/{file_id}",
        storage_type="gridfs_buffer",
        message="Photo saved to temporary GridFS buffer",
    )


@router.get("/photo/regular/{file_id}")
@router.get("/regular/{file_id}")
async def get_regular_visitor_photo(
    file_id: str, request: "Request"
):
    """
    Retrieve regular visitor photo from GridFS

    Returns the image file
    """
    from fastapi.responses import Response
    # Validate Authorization header first (existing protected behavior)
    from fastapi.responses import Response
    auth = request.headers.get("authorization")

    # Helper to load and return photo bytes
    async def _load_and_respond(fid: str):
        photo_data = await photo_storage.get_regular_visitor_photo(fid)
        if not photo_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
            )
        return Response(content=photo_data, media_type="image/jpeg")

    if auth:
        # Authorized request: serve directly
        return await _load_and_respond(file_id)

    # No Authorization header — check signed query params
    qs = request.query_params
    sig = qs.get("sig")
    exp = qs.get("exp")

    if not sig or not exp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        exp_ts = int(exp)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid expiry")

    now_ts = int(datetime.utcnow().timestamp())
    if exp_ts < now_ts:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signed URL expired")

    # Compute expected signature
    msg = f"{file_id}:{exp_ts}".encode()
    expected = hmac.new(PHOTO_SIGNING_SECRET.encode(), msg, hashlib.sha256).hexdigest()

    # Constant-time compare
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    # Signature valid — serve
    return await _load_and_respond(file_id)



@router.get("/photo/regular/{file_id}/signed-url")
async def get_signed_regular_photo_url(file_id: str, _current_user: dict = Depends(get_current_guard)):
    """
    Generate a short-lived signed URL for a GridFS photo. Requires authentication.

    Returns:
        { signed_url: str }
    """
    # Default expiry: 5 minutes
    expiry_seconds = 300
    exp_ts = int((datetime.utcnow()).timestamp()) + expiry_seconds
    msg = f"{file_id}:{exp_ts}".encode()
    sig = hmac.new(PHOTO_SIGNING_SECRET.encode(), msg, hashlib.sha256).hexdigest()

    signed_url = f"{PANTRY_URL}/uploads/photo/regular/{file_id}?exp={exp_ts}&sig={sig}"
    return {"signed_url": signed_url}


@router.get("/photo/buffer/{filename}")
@router.get("/buffer/{filename}")
async def get_buffer_photo(
    filename: str,
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
    photo: UploadFile = File(...), _current_user: dict = Depends(get_current_guard)
):
    """
    Upload ID card photo (Aadhar/PAN) to Cloudinary
    """
    # Basic content type whitelist for ID card photos
    if photo.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only JPEG and PNG images are allowed")

    photo_data = await photo.read()

    # Ensure validation runs (async) and is awaited so invalid files are rejected
    is_valid, error_msg = await photo_storage.validate_photo(photo_data, max_size_mb=10)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    photo_url = await photo_storage.save_new_visitor_photo_buffer(
        photo_data, photo.filename or "id_card_photo.jpg"
    )

    storage_type = "cloudinary" if photo_url.startswith("http") else "local_buffer"
    return PhotoUploadResponse(
        photo_url=photo_url, storage_type=storage_type, message="ID card photo uploaded"
    )

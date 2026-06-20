"""
Photo Upload Router - stores all new uploads in Cloudinary.
GET endpoints retain GridFS backward-compat for pre-migration records.
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Request
from pydantic import BaseModel

from middleware.auth import get_current_user, get_current_guard, require_role
from utils.storage import photo_storage
from config import PANTRY_URL, PHOTO_SIGNING_SECRET
import hmac
import hashlib
from datetime import datetime


router = APIRouter(prefix="/uploads", tags=["Uploads"])

_GRIDFS_ID_RE = __import__("re").compile(r"^[a-f0-9]{24}$", __import__("re").IGNORECASE)


def _is_gridfs_id(value: str) -> bool:
    return bool(_GRIDFS_ID_RE.match(value))


def _extract_gridfs_id(value: str) -> str | None:
    """Return a GridFS ObjectId from a raw ID or a /uploads/photo/*/id path."""
    for prefix in ("/uploads/photo/regular/", "/uploads/photo/buffer/",
                   "/uploads/regular/", "/uploads/buffer/"):
        if value.startswith(prefix):
            value = value[len(prefix):]
            break
    return value if _is_gridfs_id(value) else None


class PhotoUploadResponse(BaseModel):
    photo_url: str
    storage_type: str
    message: str


# ── Upload endpoints (Cloudinary) ────────────────────────────────────────────

@router.post("/photo/regular", response_model=PhotoUploadResponse)
@router.post("/photo/regular-visitor", response_model=PhotoUploadResponse)
async def upload_regular_visitor_photo(
    photo: UploadFile = File(...),
    _current_user: dict = Depends(get_current_guard),
):
    """Upload a regular visitor photo to Cloudinary."""
    if photo.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only JPEG and PNG images are allowed")

    photo_data = await photo.read()
    is_valid, error_msg = await photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    cloudinary_url = await photo_storage.save_regular_visitor_photo(
        photo_data, photo.filename or "visitor_photo.jpg"
    )

    return PhotoUploadResponse(
        photo_url=cloudinary_url,
        storage_type="cloudinary",
        message="Photo uploaded to Cloudinary",
    )


@router.post("/photo/new-visitor", response_model=PhotoUploadResponse)
async def upload_new_visitor_photo(
    photo: UploadFile = File(...),
    _current_user: dict = Depends(get_current_guard),
):
    """Upload a new visitor photo to Cloudinary."""
    if photo.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only JPEG and PNG images are allowed")

    photo_data = await photo.read()
    is_valid, error_msg = await photo_storage.validate_photo(photo_data)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    cloudinary_url = await photo_storage.save_new_visitor_photo_buffer(
        photo_data, photo.filename or "new_visitor_photo.jpg"
    )

    return PhotoUploadResponse(
        photo_url=cloudinary_url,
        storage_type="cloudinary",
        message="Photo uploaded to Cloudinary",
    )


@router.post("/photo/id-card", response_model=PhotoUploadResponse)
async def upload_id_card_photo(
    photo: UploadFile = File(...),
    _current_user: dict = Depends(get_current_guard),
):
    """Upload an ID card photo to Cloudinary."""
    if photo.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only JPEG and PNG images are allowed")

    photo_data = await photo.read()
    is_valid, error_msg = await photo_storage.validate_photo(photo_data, max_size_mb=10)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    cloudinary_url = await photo_storage.save_new_visitor_photo_buffer(
        photo_data, photo.filename or "id_card_photo.jpg"
    )

    return PhotoUploadResponse(
        photo_url=cloudinary_url,
        storage_type="cloudinary",
        message="ID card photo uploaded to Cloudinary",
    )


# ── Retrieval endpoints (backward compat for pre-migration GridFS records) ───

async def _serve_from_gridfs(file_id: str):
    """Try visitor_photos then visitor_photos_buffer. Raises 404 if not found."""
    from fastapi.responses import Response
    photo_data = await photo_storage.get_regular_visitor_photo(file_id)
    if not photo_data:
        photo_data = await photo_storage.get_gridfs_buffer_photo(file_id)
    if not photo_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return Response(content=photo_data, media_type="image/jpeg")


@router.get("/photo/regular/{file_id}")
@router.get("/regular/{file_id}")
async def get_regular_visitor_photo(file_id: str, request: "Request"):
    """
    Serve a photo from GridFS (pre-migration records only).
    New records store Cloudinary URLs; the frontend loads those directly.
    """
    # If caller somehow passes a full URL as the path param, redirect isn't
    # possible here — just 404 so the frontend falls back gracefully.
    if not _is_gridfs_id(file_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Not a valid GridFS ID")

    auth = request.headers.get("authorization")
    if auth:
        return await _serve_from_gridfs(file_id)

    # No auth header — validate signed query params
    qs = request.query_params
    sig = qs.get("sig")
    exp = qs.get("exp")

    if not sig or not exp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        exp_ts = int(exp)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid expiry")

    if exp_ts < int(datetime.utcnow().timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signed URL expired")

    msg = f"{file_id}:{exp_ts}".encode()
    expected = hmac.new(PHOTO_SIGNING_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    return await _serve_from_gridfs(file_id)


@router.get("/photo/regular/{file_id}/signed-url")
async def get_signed_regular_photo_url(
    file_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a signed URL for a GridFS photo (pre-migration records).
    For Cloudinary URLs the frontend loads them directly — this endpoint
    is only reached for legacy 24-char hex IDs.
    """
    await require_role(current_user, ["owner", "guard", "admin"])

    if not _is_gridfs_id(file_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Not a valid GridFS ID")

    expiry_seconds = 300
    exp_ts = int(datetime.utcnow().timestamp()) + expiry_seconds
    msg = f"{file_id}:{exp_ts}".encode()
    sig = hmac.new(PHOTO_SIGNING_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    base_url = str(request.base_url).rstrip("/")
    signed_url = f"{base_url}/uploads/photo/regular/{file_id}?exp={exp_ts}&sig={sig}"
    return {"signed_url": signed_url}


@router.get("/photo/buffer/{filename}")
@router.get("/buffer/{filename}")
async def get_buffer_photo(filename: str):
    """Serve a photo from the GridFS buffer (pre-migration records)."""
    from fastapi.responses import Response

    file_id = _extract_gridfs_id(filename)
    if file_id:
        photo_data = await photo_storage.get_gridfs_buffer_photo(file_id)
        if photo_data:
            return Response(content=photo_data, media_type="image/jpeg")

    # Fallback to local filesystem buffer
    photo_data = photo_storage.get_new_visitor_photo_buffer(filename)
    if not photo_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Photo not found in buffer")
    return Response(content=photo_data, media_type="image/jpeg")

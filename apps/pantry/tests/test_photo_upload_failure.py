"""
A failed photo upload must be reported, never silently worked around.

PhotoStorage used to fall back to writing the file into the local buffer
directory and returning a `/uploads/buffer/...` path, which every caller read
as success. The API container has no persistent volume, so a Cloudinary outage
quietly turned into permanently lost photos. These tests pin the replacement
behaviour: the request fails, the guard is told to retake the photo, and
nothing is written to disk.
"""

import io

import pytest
from PIL import Image

from main import app
from middleware.auth import get_current_guard
from utils.storage import PhotoUploadError, photo_storage


def make_jpeg() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), (120, 130, 140)).save(buffer, format="JPEG")
    return buffer.getvalue()


@pytest.fixture
def as_guard():
    """Bypass JWT verification - these tests are about storage, not auth."""
    app.dependency_overrides[get_current_guard] = lambda: {
        "user_id": "test-guard",
        "role": "guard",
    }
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def cloudinary_down(monkeypatch):
    from utils import cloudinary_storage as module

    monkeypatch.setattr(
        module.cloudinary_storage,
        "upload_photo",
        lambda *a, **k: (False, "Cloudinary upload failed: over quota"),
    )


@pytest.fixture
def cloudinary_up(monkeypatch):
    from utils import cloudinary_storage as module

    monkeypatch.setattr(
        module.cloudinary_storage,
        "upload_photo",
        lambda *a, **k: (True, "https://res.cloudinary.com/test/image/upload/v1/x.jpg"),
    )


@pytest.mark.asyncio
async def test_upload_reports_failure_instead_of_falling_back(
    client, as_guard, cloudinary_down
):
    response = await client.post(
        "/uploads/photo/new-visitor",
        files={"photo": ("visitor.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 503
    # The guard needs to know to retake it, and the Cloudinary error itself
    # stays in the logs rather than going out to the client.
    assert "retake" in response.json()["detail"].lower()
    assert "quota" not in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_failed_upload_writes_nothing_to_disk(client, as_guard, cloudinary_down):
    import os

    buffer_path = photo_storage.local_buffer_path
    before = set(os.listdir(buffer_path)) if os.path.isdir(buffer_path) else set()

    await client.post(
        "/uploads/photo/new-visitor",
        files={"photo": ("visitor.jpg", make_jpeg(), "image/jpeg")},
    )

    after = set(os.listdir(buffer_path)) if os.path.isdir(buffer_path) else set()
    assert after == before, "a failed upload must not leave a file on ephemeral disk"


@pytest.mark.asyncio
async def test_successful_upload_still_returns_the_cloudinary_url(
    client, as_guard, cloudinary_up
):
    response = await client.post(
        "/uploads/photo/new-visitor",
        files={"photo": ("visitor.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["photo_url"].startswith("https://res.cloudinary.com/")


@pytest.mark.asyncio
async def test_storage_raises_rather_than_returning_a_buffer_path(cloudinary_down):
    """The guarantee the routes depend on, checked without going through HTTP."""
    with pytest.raises(PhotoUploadError):
        await photo_storage.save_regular_visitor_photo(make_jpeg(), "visitor.jpg")

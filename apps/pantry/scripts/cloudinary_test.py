import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import cloudinary
import cloudinary.uploader
from config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)

# Try a simple upload using a remote sample image
result = cloudinary.uploader.upload(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
    folder="test",
    public_id="cloudinary_test_image",
    overwrite=True,
)
print("Success:", result.get("secure_url"))
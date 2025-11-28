"""
Utility functions for QR code generation
"""
import qrcode
from io import BytesIO
import base64
from typing import Optional


def generate_qr_image(data: str, size: int = 300) -> str:
    """
    Generate QR code image from data string
    
    Args:
        data: Data to encode in QR code (usually a JWT token)
        size: Size of QR code in pixels
    
    Returns:
        Base64 encoded PNG image string (data URL format)
    """
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    
    # Add data
    qr.add_data(data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    # Return as data URL
    return f"data:image/png;base64,{img_str}"


def save_qr_image(data: str, filepath: str, size: int = 300) -> str:
    """
    Generate and save QR code image to file
    
    Args:
        data: Data to encode in QR code
        filepath: Path to save the image
        size: Size of QR code in pixels
    
    Returns:
        Filepath where image was saved
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filepath)
    
    return filepath

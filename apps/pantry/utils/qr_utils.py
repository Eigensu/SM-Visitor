"""
Enhanced QR code utilities with detailed scanning information
Generates QR codes that contain all necessary visitor details for scanning
"""
import qrcode
from io import BytesIO
import base64
from typing import Optional, Dict, Any
import json


def generate_qr_data_with_details(visitor_data: Dict[str, Any]) -> str:
    """
    Generate QR data string with all visitor details for scanning
    
    Args:
        visitor_data: Dictionary containing visitor information
            - visitor_id: Unique visitor ID
            - name: Visitor name
            - phone: Phone number (optional)
            - visitor_type: Type of visitor (regular/temporary)
            - token: Signed JWT token for validation
            - created_at: Creation timestamp
    
    Returns:
        JSON string containing all visitor details
    """
    qr_payload = {
        "visitor_id": visitor_data.get("visitor_id"),
        "name": visitor_data.get("name"),
        "phone": visitor_data.get("phone"),
        "type": visitor_data.get("visitor_type", "regular"),
        "token": visitor_data.get("token"),
        "created_at": visitor_data.get("created_at"),
        "version": "1.0"  # QR format version for future compatibility
    }
    
    return json.dumps(qr_payload)


def parse_qr_data(qr_string: str) -> Optional[Dict[str, Any]]:
    """
    Parse QR code data string back into visitor details
    
    Args:
        qr_string: JSON string from QR code
    
    Returns:
        Dictionary with visitor details or None if invalid
    """
    try:
        data = json.loads(qr_string)
        
        # Validate required fields
        if not data.get("token"):
            return None
        
        return data
    except json.JSONDecodeError:
        return None


def generate_qr_image_with_details(visitor_data: Dict[str, Any], size: int = 300) -> str:
    """
    Generate QR code image with visitor details
    
    Args:
        visitor_data: Visitor information dictionary
        size: Size of QR code in pixels
    
    Returns:
        Base64 encoded PNG image string (data URL format)
    """
    # Create QR data with all details
    qr_data = generate_qr_data_with_details(visitor_data)
    
    # Create QR code instance with higher error correction for reliability
    qr = qrcode.QRCode(
        version=None,  # Auto-determine version based on data
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction (30%)
        box_size=10,
        border=4,
    )
    
    # Add data
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    # Return as data URL
    return f"data:image/png;base64,{img_str}"


def save_qr_image_with_details(visitor_data: Dict[str, Any], filepath: str, size: int = 300) -> str:
    """
    Generate and save QR code image with visitor details to file
    
    Args:
        visitor_data: Visitor information dictionary
        filepath: Path to save the image
        size: Size of QR code in pixels
    
    Returns:
        Filepath where image was saved
    """
    qr_data = generate_qr_data_with_details(visitor_data)
    
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filepath)
    
    return filepath


def get_qr_scanning_instructions() -> Dict[str, str]:
    """
    Get instructions for scanning QR codes
    
    Returns:
        Dictionary with scanning instructions and tips
    """
    return {
        "format": "JSON payload with visitor details",
        "error_correction": "High (30% damage tolerance)",
        "required_fields": ["token", "visitor_id", "type"],
        "optional_fields": ["name", "phone", "created_at"],
        "scanning_tips": [
            "Ensure good lighting for scanning",
            "Hold camera steady and parallel to QR code",
            "QR code can be scanned even if partially damaged",
            "Scan from 10-30cm distance for best results"
        ],
        "validation": "Token must be validated server-side after scanning"
    }

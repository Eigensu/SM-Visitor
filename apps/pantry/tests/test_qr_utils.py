"""
Unit tests for QR code utilities
"""
import pytest
import json
from utils.qr_utils import (
    generate_qr_data_with_details,
    parse_qr_data,
    generate_qr_image_with_details,
    get_qr_scanning_instructions
)


def test_generate_qr_data_with_details():
    """Test QR data generation with visitor details"""
    visitor_data = {
        "visitor_id": "visitor_123",
        "name": "John Doe",
        "phone": "1234567890",
        "visitor_type": "regular",
        "token": "test_token",
        "created_at": "2024-01-01T00:00:00"
    }
    
    qr_data = generate_qr_data_with_details(visitor_data)
    
    assert qr_data is not None
    assert isinstance(qr_data, str)
    
    # Should be valid JSON
    parsed = json.loads(qr_data)
    assert parsed["visitor_id"] == "visitor_123"
    assert parsed["name"] == "John Doe"
    assert parsed["token"] == "test_token"


def test_parse_qr_data():
    """Test parsing QR data string"""
    qr_string = json.dumps({
        "visitor_id": "visitor_123",
        "name": "John Doe",
        "token": "test_token",
        "type": "regular"
    })
    
    parsed = parse_qr_data(qr_string)
    
    assert parsed is not None
    assert parsed["visitor_id"] == "visitor_123"
    assert parsed["token"] == "test_token"


def test_parse_qr_data_invalid():
    """Test parsing invalid QR data"""
    parsed = parse_qr_data("invalid json string")
    
    assert parsed is None


def test_parse_qr_data_missing_token():
    """Test parsing QR data without required token"""
    qr_string = json.dumps({
        "visitor_id": "visitor_123",
        "name": "John Doe"
        # Missing token
    })
    
    parsed = parse_qr_data(qr_string)
    
    assert parsed is None


def test_generate_qr_image_with_details():
    """Test QR image generation"""
    visitor_data = {
        "visitor_id": "visitor_123",
        "name": "John Doe",
        "visitor_type": "regular",
        "token": "test_token"
    }
    
    qr_image = generate_qr_image_with_details(visitor_data)
    
    assert qr_image is not None
    assert isinstance(qr_image, str)
    assert qr_image.startswith("data:image/png;base64,")


def test_get_qr_scanning_instructions():
    """Test QR scanning instructions"""
    instructions = get_qr_scanning_instructions()
    
    assert instructions is not None
    assert isinstance(instructions, dict)
    assert "format" in instructions
    assert "error_correction" in instructions
    assert "required_fields" in instructions
    assert "scanning_tips" in instructions

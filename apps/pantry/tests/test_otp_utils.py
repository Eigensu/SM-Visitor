"""
Unit tests for OTP utilities
"""
import pytest
from datetime import datetime, timedelta
from utils.otp_utils import generate_otp, get_otp_expiry, is_otp_valid


def test_generate_otp():
    """Test OTP generation"""
    otp = generate_otp()
    
    assert otp is not None
    assert isinstance(otp, str)
    assert len(otp) == 6
    assert otp.isdigit()


def test_generate_otp_uniqueness():
    """Test that OTPs are different (statistically)"""
    otps = [generate_otp() for _ in range(10)]
    
    # At least some should be different
    assert len(set(otps)) > 1


def test_get_otp_expiry():
    """Test OTP expiry calculation"""
    expiry = get_otp_expiry()
    
    assert expiry is not None
    assert isinstance(expiry, datetime)
    assert expiry > datetime.utcnow()


def test_is_otp_valid_not_expired():
    """Test OTP validation for non-expired OTP"""
    expiry = datetime.utcnow() + timedelta(minutes=5)
    
    assert is_otp_valid(expiry) is True


def test_is_otp_valid_expired():
    """Test OTP validation for expired OTP"""
    expiry = datetime.utcnow() - timedelta(minutes=1)
    
    assert is_otp_valid(expiry) is False


def test_is_otp_valid_edge_case():
    """Test OTP validation at exact expiry time"""
    expiry = datetime.utcnow()
    
    # Should be invalid (expired)
    assert is_otp_valid(expiry) is False

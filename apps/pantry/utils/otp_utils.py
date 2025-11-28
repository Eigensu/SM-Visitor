"""
Utility functions for OTP generation and validation
"""
import random
import string
from datetime import datetime, timedelta
from config import OTP_LENGTH, OTP_EXPIRY_MINUTES


def generate_otp() -> str:
    """
    Generate a random numeric OTP
    
    Returns:
        OTP string of configured length
    """
    return ''.join(random.choices(string.digits, k=OTP_LENGTH))


def get_otp_expiry() -> datetime:
    """
    Get OTP expiration timestamp
    
    Returns:
        Datetime object for OTP expiry
    """
    return datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)


def is_otp_valid(otp_expires_at: datetime) -> bool:
    """
    Check if OTP is still valid (not expired)
    
    Args:
        otp_expires_at: OTP expiration datetime
    
    Returns:
        True if OTP is valid, False otherwise
    """
    return datetime.utcnow() < otp_expires_at


def send_otp(phone: str, otp: str) -> bool:
    """
    Send OTP to phone number
    For development, just print to console
    In production, integrate with SMS service (Twilio, MSG91, etc.)
    
    Args:
        phone: Phone number to send OTP to
        otp: OTP code to send
    
    Returns:
        True if sent successfully
    """
    # Development: print to console
    print(f"📱 OTP for {phone}: {otp}")
    
    # Production: integrate with SMS service
    # Example with Twilio:
    # client = TwilioClient(account_sid, auth_token)
    # message = client.messages.create(
    #     body=f"Your SM-Visitor OTP is: {otp}",
    #     from_=twilio_phone,
    #     to=phone
    # )
    
    return True

"""
Time utilities for IST (Indian Standard Time) alignment
"""
from datetime import datetime
import pytz

IST = pytz.timezone('Asia/Kolkata')

def get_utc_now() -> datetime:
    """
    Returns the current UTC time as a naive datetime object.
    Used for storage in MongoDB which expects UTC.
    """
    return datetime.utcnow()

def get_ist_now() -> datetime:
    """
    Returns the current IST-aware datetime.
    """
    return datetime.now(pytz.utc).astimezone(IST)

def format_ist(dt: datetime) -> str:
    """
    Format a datetime object to ISO string in IST
    """
    if dt.tzinfo is None:
        # Assume UTC if no timezone info
        dt = pytz.utc.localize(dt)
    
    return dt.astimezone(IST).isoformat()

def parse_to_ist(iso_string: str) -> datetime:
    """
    Parse an ISO string and convert to IST-aware datetime.
    """
    try:
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(IST)
    except Exception:
        return get_ist_now()

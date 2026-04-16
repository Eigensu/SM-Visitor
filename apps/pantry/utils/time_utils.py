"""
Time utilities for IST (Indian Standard Time) alignment
"""
from datetime import datetime
import pytz

IST = pytz.timezone('Asia/Kolkata')

def get_ist_now() -> datetime:
    """
    Returns the current UTC time for storage in MongoDB.
    MongoDB/Motor always stores datetimes as UTC. The frontend
    converts to IST for display using the Asia/Kolkata timezone.
    """
    return datetime.utcnow()

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
    Parse an ISO string and convert to IST
    """
    try:
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(IST)
    except Exception:
        return get_ist_now()

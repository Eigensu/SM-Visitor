from datetime import datetime
from typing import Dict, Any, List, Optional
from zoneinfo import ZoneInfo
import logging
import pytz

logger = logging.getLogger(__name__)
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

def is_within_schedule(schedule: Dict[str, Any]) -> bool:
    """
    Check if current time is within the allowed schedule.
    
    Schedule format:
    {
        "enabled": bool,
        "days_of_week": List[int],  # 1=Mon, 7=Sun
        "time_windows": [
            {
                "start_time": "HH:MM",
                "end_time": "HH:MM"
            }
        ],
        "timezone": str  # e.g. "Asia/Kolkata"
    }
    """
    if not schedule or not schedule.get("enabled", False):
        return True
        
    try:
        # Get timezone
        tz_name = schedule.get("timezone", "UTC")
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            logger.warning(f"Invalid timezone {tz_name}, falling back to UTC")
            tz = ZoneInfo("UTC")
            
        # Get current time in target timezone
        now = datetime.now(tz)
        
        # Check day of week (1=Mon, 7=Sun)
        # Python weekday(): 0=Mon, 6=Sun. So we add 1.
        current_day = now.weekday() + 1
        days_of_week = schedule.get("days_of_week", [])
        
        if days_of_week and current_day not in days_of_week:
            return False
            
        # Check time windows
        time_windows = schedule.get("time_windows", [])
        if not time_windows:
            return True # No time windows specified means all day allowed if day matches
            
        current_time_str = now.strftime("%H:%M")
        
        for window in time_windows:
            start = window.get("start_time")
            end = window.get("end_time")
            
            if not start or not end:
                continue
                
            # Simple string comparison works for HH:MM 24h format
            # Handle overnight windows e.g. 23:00 to 02:00
            if start <= end:
                if start <= current_time_str <= end:
                    return True
            else: # Overnight window
                if current_time_str >= start or current_time_str <= end:
                    return True
                    
        return False
        
    except Exception as e:
        logger.error(f"Error checking schedule: {e}")
        return False

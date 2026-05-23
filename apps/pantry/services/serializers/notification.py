from __future__ import annotations

from datetime import datetime
from typing import Any

from utils.time_utils import get_utc_now


def _as_str(value: Any) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    return str(value)


def _as_iso_datetime(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def serialize_notification(notification: dict[str, Any]) -> dict[str, Any]:
    """Return a stable notification contract with legacy aliases preserved."""
    title = _as_str(notification.get("title")) or "Notification"
    message = (
        _as_str(notification.get("message"))
        or _as_str(notification.get("body"))
        or _as_str(notification.get("text"))
        or title
    )
    created_at = _as_iso_datetime(notification.get("created_at")) or get_utc_now().isoformat()
    notif_id = _as_str(notification.get("_id") or notification.get("id") or notification.get("notification_id"))

    return {
        "id": notif_id,
        "_id": notif_id,
        "notification_id": notif_id,
        "type": _as_str(notification.get("type")) or "general",
        "title": title,
        "message": message,
        "body": message,
        "text": message,
        "recipient_id": _as_str(notification.get("recipient_id")),
        "is_read": bool(notification.get("is_read", False)),
        "data": notification.get("data"),
        "created_at": created_at,
    }


def build_notification_document(
    *,
    title: str,
    message: str,
    type: str,
    recipient_id: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a persisted notification document with stable message aliases."""
    return {
        "title": title,
        "message": message,
        "body": message,
        "text": message,
        "type": type,
        "recipient_id": recipient_id,
        "is_read": False,
        "data": data or {},
        "created_at": get_utc_now(),
    }

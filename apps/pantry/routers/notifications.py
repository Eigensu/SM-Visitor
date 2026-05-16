"""
Notifications Router - REST API for managing persistent user notifications
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from bson import ObjectId
from bson.errors import InvalidId

from database import get_notifications_collection
from middleware.auth import get_current_user
from services.serializers.notification import serialize_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[dict])
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """
    Get notifications for the current user
    """
    user_id = current_user["user_id"]
    notifications = get_notifications_collection()

    query = {"recipient_id": user_id}
    if unread_only:
        query["is_read"] = False

    cursor = notifications.find(query).sort("created_at", -1).limit(limit)
    results = []
    async for doc in cursor:
        results.append(serialize_notification(doc))

    return results


@router.get("/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get the count of unread notifications."""
    user_id = current_user["user_id"]
    notifications = get_notifications_collection()

    count = await notifications.count_documents(
        {"recipient_id": user_id, "is_read": False}
    )

    return {"count": count}


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Mark a notification as read
    """
    user_id = current_user["user_id"]
    notifications = get_notifications_collection()

    try:
        result = await notifications.update_one(
            {"_id": ObjectId(notification_id), "recipient_id": user_id},
            {"$set": {"is_read": True}},
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
            )

        return {"success": True}
    except InvalidId as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid notification ID"
        ) from exc


@router.post("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """
    Mark all notifications for the current user as read
    """
    user_id = current_user["user_id"]
    notifications = get_notifications_collection()

    await notifications.update_many(
        {"recipient_id": user_id, "is_read": False}, {"$set": {"is_read": True}}
    )

    return {"success": True}

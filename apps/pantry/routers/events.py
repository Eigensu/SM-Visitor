"""
SSE Events Router - Real-time notifications via Server-Sent Events
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from middleware.auth import get_current_user
from utils.sse_manager import sse_manager


router = APIRouter(prefix="/events", tags=["Events"])


@router.get("/stream")
async def event_stream(current_user: dict = Depends(get_current_user)):
    """
    Establish SSE connection for real-time notifications
    
    - Owners receive: new_visit_pending, visit_auto_approved
    - Guards receive: visit_approved, visit_rejected
    
    Connection stays open and sends events as they occur
    """
    user_id = current_user["user_id"]
    role = current_user["role"]
    
    # Create connection queue
    queue = await sse_manager.connect(user_id, role)
    
    async def event_generator():
        try:
            async for event in sse_manager.event_generator(queue):
                yield event
        finally:
            # Clean up on disconnect
            await sse_manager.disconnect(user_id, queue)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/test")
async def test_event(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Test endpoint to send a test event to a user
    
    For development/testing purposes only
    """
    await sse_manager.send_event(
        user_id,
        "test_event",
        {
            "message": "This is a test event",
            "sent_by": current_user["user_id"]
        }
    )
    
    return {"success": True, "message": f"Test event sent to user {user_id}"}

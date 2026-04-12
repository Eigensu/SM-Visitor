"""
SSE (Server-Sent Events) Manager for real-time notifications
Manages connections and broadcasts events to owners and guards
"""
from typing import Dict, Set, Optional
from fastapi import Request
from fastapi.responses import StreamingResponse
import asyncio
import json
from datetime import datetime
from utils.time_utils import get_ist_now


class SSEManager:
    """
    Manages Server-Sent Events connections for real-time notifications
    """
    
    def __init__(self):
        # Map of user_id to set of connections (supports multiple devices)
        self.connections: Dict[str, Set[asyncio.Queue]] = {}
        # Map of user_id to role for role-based broadcasting
        self.user_roles: Dict[str, str] = {}
        # Global Event Counter (Metrics)
        self.event_count = 0
    
    def _generate_event_id(self) -> str:
        """Internal helper for unique event tracking"""
        import uuid
        return str(uuid.uuid4())
    
    async def connect(self, user_id: str, role: str) -> asyncio.Queue:
        """
        Create a new SSE connection for a user
        
        Args:
            user_id: User ID
            role: User role (owner, guard, admin)
        
        Returns:
            Queue for sending events to this connection
        """
        queue = asyncio.Queue()
        
        if user_id not in self.connections:
            self.connections[user_id] = set()
        
        self.connections[user_id].add(queue)
        self.user_roles[user_id] = role
        
        print(f"✅ SSE connected: user_id={user_id}, role={role}")
        return queue
    
    async def disconnect(self, user_id: str, queue: asyncio.Queue):
        """
        Remove an SSE connection
        
        Args:
            user_id: User ID
            queue: Queue to remove
        """
        if user_id in self.connections:
            self.connections[user_id].discard(queue)
            
            # Clean up if no more connections
            if not self.connections[user_id]:
                del self.connections[user_id]
                if user_id in self.user_roles:
                    del self.user_roles[user_id]
        
        print(f"🔌 SSE disconnected: user_id={user_id}")
    
    async def send_event(self, user_id: str, event_type: str, data: dict):
        """
        Send an event to a specific user (all their connections)
        AND save it as a persistent notification in the DB
        """
        # 1. Prepare Persistent Notification
        try:
            from database import get_notifications_collection
            from models import NotificationModel
            
            # Map event type to Title/Message
            title = "Notification"
            message = "You have a new alert"
            
            if event_type == "new_visit_pending":
                title = "Entry Request"
                message = f"New visitor {data.get('visitor_name', '')} is at the gate."
            elif event_type == "visit_approved":
                title = "Visit Approved"
                message = f"Your visitor {data.get('visitor_name', '')} has been approved."
            elif event_type == "visit_rejected":
                title = "Visit Rejected"
                message = f"Your visitor {data.get('visitor_name', '')} was rejected."
            elif event_type == "new_regular_visitor_pending":
                title = "Staff Registration"
                message = f"Guard has registered a new staff: {data.get('visitor_name', '')}."
            
            notif_doc = NotificationModel(
                title=title,
                message=message,
                type=event_type,
                recipient_id=user_id,
                data=data
            )
            
            # Save to DB - don't await to keep it fast? 
            # No, we should await but it's okay because Mongo is fast.
            # However, for MAX performance, we wrap in try-except.
            notifications = get_notifications_collection()
            await notifications.insert_one(notif_doc.dict(by_alias=True, exclude_none=True))
            
        except Exception as e:
            print(f"⚠️  Failed to save persistent notification: {e}")

        # 2. Push to Active Connections (Real-time)
        if user_id not in self.connections:
            print(f"ℹ️  No active SSE connections for user_id={user_id}, event cached in DB only.")
            return
        
        self.event_count += 1
        event = {
            "id": self._generate_event_id(),
            "type": event_type,
            "data": data,
            "timestamp": get_ist_now().isoformat() 
        }
        
        # Send to all connections for this user
        connection_count = len(self.connections[user_id])
        print(f"📤 [SSE {self.event_count}] Sending '{event_type}' (id={event['id']}) to {connection_count} connection(s)")
        
        for queue in list(self.connections[user_id]):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                print(f"⚠️  SSE Queue full for user_id={user_id}")
            except Exception as e:
                print(f"❌ Error sending SSE event: {e}")

    async def broadcast_to_role(self, role: str, event_type: str, data: dict):
        """
        Broadcast an event to all users with a specific role
        """
        # Snapshoting the items to avoid RuntimeError during concurrent modification
        targets = [
            user_id for user_id, user_role in list(self.user_roles.items())
            if user_role == role
        ]
        
        if targets:
            # Parallelize sending to all target users
            # Use asyncio.create_task to make it even more non-blocking?
            # For now gather is okay since we used put_nowait inside send_event
            await asyncio.gather(
                *[self.send_event(user_id, event_type, data) for user_id in targets],
                return_exceptions=True
            )
    
    async def event_generator(self, request: Request, queue: asyncio.Queue):
        """
        Generate SSE events from queue with disconnect handling
        """
        try:
            while True:
                # 1. Immediate Disconnect Check
                if await request.is_disconnected():
                    break

                try:
                    # 2. Wait for message with robust timeout (25s)
                    message = await asyncio.wait_for(queue.get(), timeout=25.0)
                    
                    event_type = message.get("type", "message")
                    event_data = message.get("data", {})
                    
                    # 3. Protocol Serialization (Strict ID/NAME/DATA format)
                    event_id = message.get("id")
                    if event_id:
                         yield f"id: {event_id}\n"
                    yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"
                    
                except asyncio.TimeoutError:
                    # 4. Mandatory Keep-Alive Heartbeat
                    yield ": keep-alive\n\n"
                    
        except asyncio.CancelledError:
            # Clean exit on task cancellation
            pass
        except Exception as e:
            # Silent logging for production stability
            print(f"❌ SSE Stream Error: {e}")
        finally:
            # Logic here runs on connection close
            pass


# Global SSE manager instance
sse_manager = SSEManager()

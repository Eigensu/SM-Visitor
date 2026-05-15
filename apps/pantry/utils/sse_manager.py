"""
SSE (Server-Sent Events) Manager for real-time notifications
Manages connections and broadcasts events to owners and guards
"""

from typing import Dict, Set
from fastapi import Request
import asyncio
import json
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

    async def send_event(self, user_id: str, event_type: str, data: dict):
        """
        Send an event to a specific user (all their connections)
        AND save it as a persistent notification in the DB
        """
        # Runtime validation must not rely on assert (asserts can be stripped with -O).
        if user_id is None or not isinstance(user_id, str) or not user_id.strip():
            print(f"❌ [SSE] Invalid user_id: {user_id}")
            return
        if not isinstance(event_type, str) or not event_type.strip():
            print(f"❌ [SSE] Invalid event_type: {event_type}")
            return
        if not isinstance(data, dict):
            print(
                f"❌ [SSE] Invalid payload type for event_type={event_type}: {type(data)}"
            )
            return

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
            elif event_type in ("visit_approved", "VISITOR_APPROVED"):
                title = "Visitor Approved"
                message = f"Visitor {data.get('visitor_name', 'a visitor')} has been approved."
            elif event_type in ("visit_rejected", "VISITOR_REJECTED"):
                title = "Visit Rejected"
                message = f"Visitor {data.get('visitor_name', '')} was rejected."
            elif event_type in ("new_regular_visitor_pending", "NEW_VISITOR_REQUEST"):
                title = "New Staff Registration"
                message = f"Guard registered: {data.get('name', 'a visitor')}. Approval needed."

            notif_doc = NotificationModel(
                title=title,
                message=message,
                type=event_type,
                recipient_id=user_id,
                data=data,
            )

            # Save to DB - don't await to keep it fast?
            # No, we should await but it's okay because Mongo is fast.
            # However, for MAX performance, we wrap in try-except.
            notifications = get_notifications_collection()
            await notifications.insert_one(
                notif_doc.model_dump(by_alias=True, exclude_none=True)
            )

        except Exception as e:
            print(f"⚠️  Failed to save persistent notification: {e}")

        # 2. Push to Active Connections (Real-time)
        active_connections = len(self.connections.get(user_id, []))

        if active_connections == 0:
            print(
                f"⚠️  [WARNING] No active SSE connections for target_user_id={user_id}. Event delivered to DB only."
            )
            return

        self.event_count += 1
        event = {
            "id": self._generate_event_id(),
            "type": event_type,
            "data": data,
            "timestamp": get_ist_now().isoformat(),
        }

        for queue in list(self.connections[user_id]):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                print(f"⚠️  SSE Queue full for target_user_id={user_id}")
            except Exception as e:
                print(f"❌ Error sending SSE event: {e}")

    async def broadcast_to_role(self, role: str, event_type: str, data: dict):
        """
        Broadcast an event to all users with a specific role
        """
        # Snapshoting the items to avoid RuntimeError during concurrent modification
        targets = [
            user_id
            for user_id, user_role in list(self.user_roles.items())
            if user_role == role
        ]

        if targets:
            # Parallelize sending to all target users
            # Use asyncio.create_task to make it even more non-blocking?
            # For now gather is okay since we used put_nowait inside send_event
            await asyncio.gather(
                *[self.send_event(user_id, event_type, data) for user_id in targets],
                return_exceptions=True,
            )

    async def broadcast_to_flats(
        self, flat_ids: list, event_type: str, data: dict, db=None
    ):
        """
        Broadcast an event to all users associated with a set of flat IDs
        """
        if not flat_ids or not db:
            print(
                f"⚠️  [SSE] Cannot broadcast to flats: flat_ids={flat_ids}, db_provided={db is not None}"
            )
            return

        # 1. Resolve flat_ids to user_ids (owners only)
        # Using 'users' collection as verified in init_database.py
        try:
            cursor = db.users.find({"flat_id": {"$in": flat_ids}, "role": "owner"})
            # 1. Resolve flat_ids to user_ids (residents/owners)
            # Owners/residents are stored in db.residents collection (primary storage for unit owners)
            try:
                cursor = db.residents.find({"flat_id": {"$in": flat_ids}})
                owners = await cursor.to_list(length=100)

            target_user_ids = [str(owner["_id"]) for owner in owners]

            if not target_user_ids:
                print(f"⚠️  [SSE] No owners found for flats: {flat_ids}")
                return

            # 2. Parallel Broadcast
            print(
                f"📢 [SSE BROADCAST] target_flats={flat_ids}, target_users={len(target_user_ids)}"
            )
            await asyncio.gather(
                *[
                    self.send_event(user_id, event_type, data)
                    for user_id in target_user_ids
                ],
                return_exceptions=True,
            )
        except Exception as e:
            print(f"❌ [SSE] Broadcast to flats failed: {e}")

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

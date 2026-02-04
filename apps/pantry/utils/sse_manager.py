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


class SSEManager:
    """
    Manages Server-Sent Events connections for real-time notifications
    """
    
    def __init__(self):
        # Map of user_id to set of connections (supports multiple devices)
        self.connections: Dict[str, Set[asyncio.Queue]] = {}
        # Map of user_id to role for role-based broadcasting
        self.user_roles: Dict[str, str] = {}
    
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
        
        Args:
            user_id: User ID to send to
            event_type: Type of event
            data: Event data
        """
        if user_id not in self.connections:
            print(f"⚠️  No SSE connection for user_id={user_id}")
            return
        
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all connections for this user
        for queue in self.connections[user_id]:
            try:
                await queue.put(event)
            except Exception as e:
                print(f"❌ Error sending SSE event: {e}")
    
    async def broadcast_to_role(self, role: str, event_type: str, data: dict):
        """
        Broadcast an event to all users with a specific role
        
        Args:
            role: User role to broadcast to
            event_type: Type of event
            data: Event data
        """
        for user_id, user_role in self.user_roles.items():
            if user_role == role:
                await self.send_event(user_id, event_type, data)
    
    async def broadcast_to_flats(self, flat_ids: list[str], event_type: str, data: dict, db):
        """
        Broadcast an event to all residents of specific flats
        """
        if not flat_ids:
            return
            
        # Find all residents associated with these flats
        residents = await db.residents.find({"flat_id": {"$in": flat_ids}}).to_list(length=100)
        user_ids = [str(r["_id"]) for r in residents]
        
        for user_id in user_ids:
            await self.send_event(user_id, event_type, data)
    
    async def event_generator(self, queue: asyncio.Queue):
        """
        Generate SSE events from queue
        
        Args:
            queue: Queue to read events from
        
        Yields:
            SSE formatted event strings
        """
        try:
            while True:
                # Wait for event with timeout for keep-alive
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    
                    # Format as SSE
                    event_str = f"event: {event['type']}\n"
                    event_str += f"data: {json.dumps(event['data'])}\n\n"
                    
                    yield event_str
                    
                except asyncio.TimeoutError:
                    # Send keep-alive comment
                    yield ": keep-alive\n\n"
                    
        except asyncio.CancelledError:
            # Connection closed
            pass


# Global SSE manager instance
sse_manager = SSEManager()

/**
 * SSE Hook for Real-time Notifications
 * Manages Server-Sent Events connection lifecycle
 *
 * This is a generic hook that can be used by both Orbit and Horizon apps
 * by providing app-specific configuration.
 */
"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

export interface SSEConfig {
  /**
   * Whether the user is authenticated and SSE should be active
   */
  isAuthenticated: boolean;

  /**
   * Function to create the SSE connection
   * Should return an EventSource instance or null
   */
  createConnection: () => EventSource | null;

  /**
   * Callback to handle the default 'message' event (unnamed events)
   */
  onMessage?: (data: any) => void;

  /**
   * Map of named event handlers (e.g., {"VISITOR_APPROVED": (data) => ...})
   */
  handlers?: Record<string, (data: any) => void>;

  /**
   * Maximum number of reconnection attempts (default: 5)
   */
  maxReconnectAttempts?: number;

  /**
   * Maximum reconnection delay in milliseconds (default: 30000)
   */
  maxReconnectDelay?: number;
}

export function useSSE(config: SSEConfig) {
  const {
    isAuthenticated,
    createConnection,
    onMessage,
    handlers = {},
    maxReconnectAttempts = 5,
    maxReconnectDelay = 30000,
  } = config;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const seenEventIds = useRef<Set<string>>(new Set());
  const isConnecting = useRef(false);

  // Helper to deduplicate events
  const handleEvent = (handler: (data: any) => void, event: any, type: string) => {
    try {
      if (!event.data) return;

      // SSE ID is available on the event object itself
      // We also check the data for a fallback id
      const data = JSON.parse(event.data);
      const eventId = event.lastEventId || data.id;

      if (eventId) {
        if (seenEventIds.current.has(eventId)) {
          console.debug(`♻️ SSE: Skipping duplicate event [${type}] (id=${eventId})`);
          return;
        }
        seenEventIds.current.add(eventId);

        // Keep the set from growing infinitely
        if (seenEventIds.current.size > 100) {
          const firstItem = seenEventIds.current.values().next().value;
          if (firstItem !== undefined) seenEventIds.current.delete(firstItem);
        }
      }

      console.log(`📡 SSE: Received event [${type}]`, data);
      handler(data);
    } catch (error) {
      console.error(`❌ SSE: Parse error in [${type}] listener`, error);
    }
  };

  const connect = () => {
    if (!isAuthenticated || isConnecting.current || eventSourceRef.current) return;

    isConnecting.current = true;
    try {
      const es = createConnection();
      eventSourceRef.current = es;

      if (es) {
        es.onopen = () => {
          console.log("✅ SSE: Connection established");
          reconnectAttempts.current = 0;
          isConnecting.current = false;
        };

        es.onerror = (error) => {
          console.warn("⚠️ SSE: Connection lost, attempting reconnection...");
          isConnecting.current = false;
          reconnect();
        };

        // Default message listener
        es.onmessage = (event) => {
          if (!onMessage) return;
          handleEvent(onMessage, event, "message");
        };

        // Named listeners
        Object.entries(handlers).forEach(([eventType, handler]) => {
          es.addEventListener(eventType, (event: any) => {
            handleEvent(handler, event, eventType);
          });
        });
      }
    } catch (error) {
      console.error("❌ SSE: Failed to create connection", error);
      isConnecting.current = false;
    }
  };

  const reconnect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error("❌ SSE: Maximum reconnection attempts reached.");
      toast.error("Lost real-time connection to server.", { duration: 6000 });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
    reconnectAttempts.current++;

    console.log(
      `Reconnecting SSE in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      // Named listeners are automatically cleaned up when the EventSource is closed
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttempts.current = 0;
  };

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, Object.keys(handlers).join(",")]); // Re-connect if handlers change

  return { disconnect };
}

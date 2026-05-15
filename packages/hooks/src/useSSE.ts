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

type SSEPayload = Record<string, unknown>;
type SSEEventHandler = (data: SSEPayload) => void;

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
  onMessage?: SSEEventHandler;

  /**
   * Map of named event handlers (e.g., {"VISITOR_APPROVED": (data) => ...})
   */
  handlers?: Record<string, SSEEventHandler>;

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
  const onMessageRef = useRef<SSEEventHandler | undefined>(onMessage);
  const handlersRef = useRef<Record<string, SSEEventHandler>>(handlers);

  useEffect(() => {
    onMessageRef.current = onMessage;
    handlersRef.current = handlers;
  }, [onMessage, handlers]);

  // Helper to deduplicate events
  const handleEvent = (handler: SSEEventHandler, event: Event) => {
    try {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") return;

      // SSE ID is available on the event object itself
      // We also check the data for a fallback id
      const parsed = JSON.parse(event.data) as SSEPayload;
      const eventId =
        (event.lastEventId as string | undefined) ||
        (typeof parsed.id === "string" ? parsed.id : undefined);

      if (eventId) {
        if (seenEventIds.current.has(eventId)) {
          return;
        }
        seenEventIds.current.add(eventId);

        // Keep the set from growing infinitely
        if (seenEventIds.current.size > 100) {
          const firstItem = seenEventIds.current.values().next().value;
          if (firstItem !== undefined) seenEventIds.current.delete(firstItem);
        }
      }

      handler(parsed);
    } catch (_error) {}
  };

  const connect = () => {
    if (!isAuthenticated || isConnecting.current || eventSourceRef.current) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    isConnecting.current = true;
    try {
      const es = createConnection();

      if (!es) {
        // Prevent getting stuck in a permanent "connecting" state.
        isConnecting.current = false;
        reconnect();
        return;
      }

      eventSourceRef.current = es;

      es.onopen = () => {
        reconnectAttempts.current = 0;
        isConnecting.current = false;
      };

      es.onerror = (_error) => {
        isConnecting.current = false;
        reconnect();
      };

      // Default message listener
      es.onmessage = (event) => {
        if (!onMessageRef.current) return;
        handleEvent(onMessageRef.current, event);
      };

      // Named listeners
      Object.entries(handlersRef.current).forEach(([eventType, handler]) => {
        es.addEventListener(eventType, (event: Event) => {
          handleEvent(handler, event);
        });
      });
    } catch (_error) {
      isConnecting.current = false;
    }
  };

  const reconnect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      toast.error("Lost real-time connection to server.", { duration: 6000 });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
    reconnectAttempts.current++;

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
  }, [isAuthenticated]);

  return { disconnect };
}

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
   * Whether the user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Function to create the SSE connection
   * Should return an EventSource or null
   */
  createConnection: (onMessage: (event: MessageEvent) => void) => EventSource | null;

  /**
   * Callback to handle incoming SSE events
   * Receives the parsed event data
   */
  onEvent: (data: any) => void;

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
    onEvent,
    maxReconnectAttempts = 5,
    maxReconnectDelay = 30000,
  } = config;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = () => {
    if (!isAuthenticated) return;

    try {
      eventSourceRef.current = createConnection((event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch (error) {
          console.error("SSE parse error:", error);
        }
      });

      if (eventSourceRef.current) {
        const es = eventSourceRef.current;

        es.onopen = () => {
          console.log("SSE connected successfully");
          reconnectAttempts.current = 0; // Reset on successful connection
        };

        es.onerror = (error) => {
          console.warn("SSE connection lost, will attempt to reconnect...");
          reconnect();
        };

        // CRITICAL FIX: Listen for custom event types
        // Backend sends events like: event: visit_approved, event: visit_rejected, etc.
        const eventTypes = [
          "visit_approved",
          "visit_rejected",
          "new_visit_pending",
          "visit_auto_approved",
          "visit_cancelled",
          "test_event",
        ];

        eventTypes.forEach((eventType) => {
          es.addEventListener(eventType, (event: Event) => {
            try {
              const messageEvent = event as MessageEvent;
              const data = JSON.parse(messageEvent.data);
              console.log(`📨 SSE Event [${eventType}]:`, data);
              onEvent({ type: eventType, data });
            } catch (error) {
              console.error(`SSE parse error for ${eventType}:`, error);
            }
          });
        });
      }
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
    }
  };

  const reconnect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.warn("Max SSE reconnection attempts reached. Real-time notifications disabled.");
      toast.error("Lost connection to server. Real-time notifications disabled.", {
        duration: 6000,
      });
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
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return { disconnect };
}

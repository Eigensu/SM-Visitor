/**
 * SSE Hook for Real-time Notifications
 * Manages Server-Sent Events connection lifecycle
 */
"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import toast from "react-hot-toast";

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const { isAuthenticated, updateVisitStatus } = useStore();

  const connect = () => {
    if (!isAuthenticated) return;

    try {
      eventSourceRef.current = createSSEConnection((event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "visit_approved":
              updateVisitStatus(data.data._id, "approved");
              toast.success(`Visit approved for ${data.data.name_snapshot}`, {
                duration: 5000,
                icon: "✅",
              });
              break;

            case "visit_rejected":
              updateVisitStatus(data.data._id, "rejected");
              toast.error(`Visit rejected for ${data.data.name_snapshot}`, {
                duration: 5000,
                icon: "❌",
              });
              break;

            default:
              console.log("Unknown SSE event type:", data.type);
          }
        } catch (error) {
          console.error("SSE parse error:", error);
        }
      });

      if (eventSourceRef.current) {
        eventSourceRef.current.onerror = () => {
          console.error("SSE connection error");
          reconnect();
        };

        // Reset reconnect attempts on successful connection
        reconnectAttempts.current = 0;
      }
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
    }
  };

  const reconnect = () => {
    if (reconnectAttempts.current >= 5) {
      console.error("Max reconnection attempts reached");
      toast.error("Lost connection to server. Please refresh the page.");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Reconnecting SSE (attempt ${reconnectAttempts.current})...`);
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
  }, [isAuthenticated]);

  return { disconnect };
}

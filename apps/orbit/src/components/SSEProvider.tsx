/**
 * SSE Provider Component
 * Provides SSE connection to the entire app
 */
"use client";

import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import toast from "react-hot-toast";

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading, updateVisitStatus } = useStore();

  // Check if SSE is enabled (can be disabled via env var for development)
  const sseEnabled = process.env.NEXT_PUBLIC_SSE_ENABLED !== "false";

  useSSE({
    // Only connect when auth is fully loaded, user is authenticated, and SSE is enabled
    isAuthenticated: isAuthenticated && !isAuthLoading && sseEnabled,
    createConnection: createSSEConnection,
    onEvent: (data) => {
      switch (data.type) {
        case "visit_approved":
          // Backend sends: { visit_id, visitor_name, approved_at }
          updateVisitStatus(data.data.visit_id, "approved");
          toast.success(`Visit approved for ${data.data.visitor_name}`, {
            duration: 5000,
            icon: "✅",
          });
          break;

        case "visit_rejected":
          // Backend sends: { visit_id, visitor_name, rejected_at }
          updateVisitStatus(data.data.visit_id, "rejected");
          toast.error(`Visit rejected for ${data.data.visitor_name}`, {
            duration: 5000,
            icon: "❌",
          });
          break;

        default:
          console.log("Unknown SSE event type:", data.type);
      }
    },
  });

  return <>{children}</>;
}

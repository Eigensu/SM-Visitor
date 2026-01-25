/**
 * SSE Provider Component
 * Provides SSE connection to the entire app
 */
"use client";

import { useEffect } from "react";
import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import toast from "react-hot-toast";

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, updateVisitStatus, login } = useStore();

  // Hydrate auth state from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        // Only hydrate if not already authenticated
        if (!isAuthenticated) {
          login(user, token);
        }
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
      }
    }
  }, [login, isAuthenticated]);

  useSSE({
    isAuthenticated,
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

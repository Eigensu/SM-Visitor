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
  const { isAuthenticated, updateVisitStatus } = useStore();

  useSSE({
    isAuthenticated,
    createConnection: createSSEConnection,
    onEvent: (data) => {
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
    },
  });

  return <>{children}</>;
}

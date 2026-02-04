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
  const { isAuthenticated, updateVisitStatus, addPendingVisit } = useStore();

  useSSE({
    isAuthenticated,
    createConnection: createSSEConnection,
    onEvent: (data) => {
      switch (data.type) {
        case "visit_approved":
          updateVisitStatus(data.data.visit_id || data.data._id, "approved");
          toast.success(`Visit approved for ${data.data.visitor_name || data.data.name_snapshot}`, {
            duration: 5000,
            icon: "✅",
          });
          break;

        case "visit_rejected":
          updateVisitStatus(data.data.visit_id || data.data._id, "rejected");
          toast.error(`Visit rejected for ${data.data.visitor_name || data.data.name_snapshot}`, {
            duration: 5000,
            icon: "❌",
          });
          break;

        case "new_visit_pending":
          // Add to pending list
          const newVisit = {
            id: data.data.visit_id,
            name_snapshot: data.data.visitor_name,
            phone_snapshot: data.data.visitor_phone,
            photo_snapshot_url: data.data.photo_url,
            purpose: data.data.purpose,
            owner_id: "", // Will be enriched or not needed for local display
            guard_id: data.data.guard_id,
            status: "pending" as const,
            created_at: new Date().toISOString(),
          };

          addPendingVisit(newVisit);

          toast(`Incoming visitor: ${data.data.visitor_name}`, {
            duration: 8000,
            icon: "🔔",
            style: {
              border: "2px solid #8b5cf6",
              padding: "16px",
              color: "#1e1b4b",
              fontWeight: "bold",
            },
          });
          break;

        case "visit_auto_approved":
          toast.success(`${data.data.visitor_name} has entered (QR Code)`, {
            duration: 5000,
            icon: "🚪",
          });
          break;

        default:
          console.log("Unknown SSE event type:", data.type);
      }
    },
  });

  return <>{children}</>;
}

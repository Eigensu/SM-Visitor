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
  const {
    isAuthenticated,
    updateVisitStatus,
    addPendingVisit,
    removePendingVisit,
    setRecentActivity,
  } = useStore();

  useSSE({
    isAuthenticated,
    createConnection: createSSEConnection,
    onEvent: (data) => {
      console.log("SSE event received:", data.type, data.data);

      switch (data.type) {
        case "new_visit_pending":
          // New visitor request - add to pending list
          addPendingVisit({
            id: data.data.visit_id,
            name_snapshot: data.data.visitor_name,
            phone_snapshot: data.data.visitor_phone,
            photo_snapshot_url: data.data.photo_url,
            purpose: data.data.purpose,
            owner_id: data.data.owner_id || "",
            guard_id: data.data.guard_id,
            status: "pending",
            created_at: new Date().toISOString(),
          });

          toast.success(`New visitor request: ${data.data.visitor_name}`, {
            duration: 5000,
            icon: "🔔",
          });
          break;

        case "visit_auto_approved":
          // QR code visit - show notification
          toast.success(`${data.data.visitor_name} entered using QR code`, {
            duration: 5000,
            icon: "✅",
          });
          break;

        case "visit_approved":
          updateVisitStatus(data.data.visit_id, "approved");
          toast.success(`Visit approved for ${data.data.visitor_name}`, {
            duration: 5000,
            icon: "✅",
          });
          break;

        case "visit_rejected":
          updateVisitStatus(data.data.visit_id, "rejected");
          toast.error(`Visit rejected for ${data.data.visitor_name}`, {
            duration: 5000,
            icon: "❌",
          });
          break;

        case "visit_cancelled":
          // Visit cancelled by guard - remove from pending list
          removePendingVisit(data.data.visit_id);
          toast(`Visit request cancelled: ${data.data.visitor_name}`, {
            duration: 4000,
            icon: "ℹ️",
          });
          break;

        default:
          console.log("Unknown SSE event type:", data.type);
      }
    },
  });

  return <>{children}</>;
}

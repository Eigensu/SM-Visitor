/**
 * SSE Provider Component
 * Provides SSE connection to the entire app
 */
"use client";

import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, updateVisitStatus, addPendingVisit, removePendingVisit } = useStore();

  useSSE({
    isAuthenticated,
    createConnection: createSSEConnection,
    onEvent: (data) => {
      console.log("SSE event received:", data.type, data.data);

      switch (data.type) {
        case "new_visit_pending": {
          const name = data.data.visitor_name || "Unknown";

          addPendingVisit({
            id: data.data.visit_id,
            name_snapshot: name,
            phone_snapshot: data.data.visitor_phone,
            photo_snapshot_url: data.data.photo_url,
            purpose: data.data.purpose,
            owner_id: data.data.owner_id || "",
            guard_id: data.data.guard_id,
            status: "pending",
            created_at: new Date().toISOString(),
          });

          // In-app toast
          toast(`${name} is requesting entry`, {
            duration: 8000,
            icon: "🔔",
          });

          // OS-level browser notification
          sendNotification("Visitor Approval Required", {
            body: `${name} is at the gate${data.data.purpose ? ` — ${data.data.purpose}` : ""}. Tap to review.`,
            tag: `visit-pending-${data.data.visit_id}`,
            onClick: () => router.push("/approvals"),
          });
          break;
        }

        case "visit_auto_approved": {
          const name = data.data.visitor_name || "Visitor";

          toast.success(`${name} entered using QR code`, {
            duration: 5000,
            icon: "✅",
          });

          sendNotification("Visitor Auto-Approved", {
            body: `${name} has entered the premises automatically.`,
            tag: `visit-auto-${data.data.visit_id}`,
          });
          break;
        }

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
          removePendingVisit(data.data.visit_id);
          toast(`Visit request cancelled: ${data.data.visitor_name}`, {
            duration: 4000,
            icon: "ℹ️",
          });
          break;

        case "new_user_registered": {
          const roleName =
            data.data.role === "owner"
              ? "resident"
              : data.data.role === "guard"
                ? "guard"
                : "user";
          const flatInfo = data.data.flat_id ? ` (Flat ${data.data.flat_id})` : "";
          toast(`New ${roleName} registered: ${data.data.name}${flatInfo}`, {
            duration: 6000,
            icon: "👤",
          });
          sendNotification("New User Registered", {
            body: `${data.data.name}${flatInfo} has registered as a ${roleName}.`,
            tag: `new-user-${data.data.user_id}`,
          });
          break;
        }

        default:
          console.log("Unknown SSE event type:", data.type);
      }
    },
  });

  return <>{children}</>;
}

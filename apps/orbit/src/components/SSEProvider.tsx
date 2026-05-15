/**
 * SSE Provider Component
 * provides real-time updates for Orbit Guard App
 */
"use client";

import { useSSE, safeString } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import toast from "react-hot-toast";

interface SSEEventData {
  [key: string]: any;
}

interface SSEProviderProps {
  children: React.ReactNode;
  onRefresh?: () => void;
}

export function SSEProvider({ children, onRefresh }: SSEProviderProps) {
  const { isAuthenticated, isAuthLoading, updateVisitStatus, triggerRefresh } = useStore();

  useSSE({
    isAuthenticated: isAuthenticated && !isAuthLoading,
    createConnection: createSSEConnection,
    handlers: {
      VISITOR_APPROVED: (data: SSEEventData) => {
        const visitorName = safeString(data, "visitor_name", "Visitor");

        console.log("✅ [ORBIT] Visitor approved event:", data);
        toast.success(`Approved: ${visitorName}`, {
          icon: "✅",
          duration: 5000,
        });

        triggerRefresh("visitors");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      visit_auto_approved: (data: SSEEventData) => {
        const visitorName = safeString(data, "name_snapshot", "Visitor");

        console.log("🚀 [ORBIT] Visit auto-approved:", data);
        toast.success(`Auto-Approved: ${visitorName}`, {
          icon: "⚡",
          duration: 4000,
        });

        triggerRefresh("visitors");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      NEW_VISITOR_REQUEST: (data: SSEEventData) => {
        console.log("🔔 [ORBIT] New request created:", data);
        triggerRefresh("visitors");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      VISITOR_REJECTED: (data: SSEEventData) => {
        const visitorName = safeString(data, "visitor_name", "Staff Registration");

        console.log("❌ [ORBIT] Visitor registration rejected:", data);
        toast.error(`Rejected: ${visitorName}`, {
          icon: "❌",
          duration: 5000,
        });
        triggerRefresh("visitors");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      visit_approved: (data: SSEEventData) => {
        const visitId = data?.visit_id || data?._id;
        if (visitId) {
          updateVisitStatus(String(visitId), "approved");
        }
        const visitorName = safeString(data, "visitor_name", "Visitor");
        toast.success(`Visit Approved: ${visitorName}`, { icon: "✅" });
        if (onRefresh) onRefresh();
      },

      visit_rejected: (data: SSEEventData) => {
        const visitId = data?.visit_id || data?._id;
        if (visitId) {
          updateVisitStatus(String(visitId), "rejected");
        }
        const visitorName = safeString(data, "visitor_name", "Visitor");
        toast.error(`Visit Rejected: ${visitorName}`, { icon: "❌" });
        if (onRefresh) onRefresh();
      },
    },
  });

  return <>{children}</>;
}

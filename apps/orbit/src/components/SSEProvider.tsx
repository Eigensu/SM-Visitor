/**
 * SSE Provider Component
 * provides real-time updates for Orbit Guard App
 */
"use client";

import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import toast from "react-hot-toast";

interface SSEProviderProps {
  children: React.ReactNode;
  onRefresh?: () => void; // Callback to trigger data refetch
}

export function SSEProvider({ children, onRefresh }: SSEProviderProps) {
  const { isAuthenticated, isAuthLoading, updateVisitStatus, triggerRefresh } = useStore();

  useSSE({
    isAuthenticated: isAuthenticated && !isAuthLoading,
    createConnection: createSSEConnection,
    handlers: {
      VISITOR_APPROVED: (data: any) => {
        console.log("✅ [ORBIT] Visitor approved event:", data);
        toast.success(`Approved: ${data.visitor_name || "Visitor"}`, {
          icon: "✅",
          duration: 5000,
        });

        // 🔥 SCOPED REFRESH
        triggerRefresh("visitors");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      NEW_VISITOR_REQUEST: (data: any) => {
        console.log("🔔 [ORBIT] New request created:", data);
        triggerRefresh("visitors");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      // Legacy support for ad-hoc visits
      visit_approved: (data: any) => {
        updateVisitStatus(data.visit_id || data._id, "approved");
        toast.success(`Visit Approved: ${data.visitor_name}`, { icon: "✅" });
        if (onRefresh) onRefresh();
      },

      visit_rejected: (data: any) => {
        updateVisitStatus(data.visit_id || data._id, "rejected");
        toast.error(`Visit Rejected: ${data.visitor_name}`, { icon: "❌" });
        if (onRefresh) onRefresh();
      },
    },
  });

  return <>{children}</>;
}

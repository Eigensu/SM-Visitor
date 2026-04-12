/**
 * SSE Provider Component
 * Listens for real-time events and triggers UI updates
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
  const { isAuthenticated, user, triggerRefresh } = useStore();

  useSSE({
    // Only connect when authenticated
    isAuthenticated: isAuthenticated && !!user,
    createConnection: createSSEConnection,
    handlers: {
      NEW_VISITOR_REQUEST: (data: any) => {
        console.log("🔔 [HORIZON] New visitor request received:", data);
        toast.success(`New Request: ${data.name || "Visitor"}`, {
          icon: "👤",
          duration: 5000,
        });

        // 🔥 SCOPED REFRESH
        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      VISITOR_APPROVED: (data: any) => {
        console.log("✅ [HORIZON] Visitor approved confirmation:", data);
        triggerRefresh("visitors");
        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },

      // Legacy or other event support
      visit_request: (data: any) => {
        toast.success(`Entry Request: ${data.name_snapshot || "Guest"}`, { icon: "🚗" });
        triggerRefresh("dashboard");
        if (onRefresh) onRefresh();
      },
    },
  });

  return <>{children}</>;
}

/**
 * SSE Provider Component
 * Listens for real-time events and triggers UI updates
 */
"use client";

import { useEffect, useState } from "react";
import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface SSEProviderProps {
  children: React.ReactNode;
  onRefresh?: () => void; // Callback to trigger data refetch
}

export function SSEProvider({ children, onRefresh }: SSEProviderProps) {
  const { isAuthenticated, user, triggerRefresh } = useStore();
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false);

  useEffect(() => {
    // Safety Net: Always fetch UI state once at mount ensuring missed events
    // do not create a stale UI.
    if (isAuthenticated && !hasFetchedInitial) {
      triggerRefresh("approvals");
      triggerRefresh("dashboard");
      triggerRefresh("visitors");
      setHasFetchedInitial(true);
    }
  }, [isAuthenticated, hasFetchedInitial, triggerRefresh]);

  useSSE({
    // Only connect when authenticated AND user is fully hydrated (prevents race condition)
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

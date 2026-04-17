/**
 * SSE Provider Component
 * Listens for real-time events and triggers UI updates
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection, notificationsAPI } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";
import toast from "react-hot-toast";

interface SSEProviderProps {
  children: React.ReactNode;
  onRefresh?: () => void; // Callback to trigger data refetch
}

export function SSEProvider({ children, onRefresh }: SSEProviderProps) {
  const { isAuthenticated, user, triggerRefresh, setNotifications, setUnreadCount } = useStore();
  const router = useRouter();
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false);

  const refreshNotifications = async () => {
    try {
      const [notifications, unreadData] = await Promise.all([
        notificationsAPI.getNotifications(false),
        notificationsAPI.getUnreadCount(),
      ]);

      setNotifications(notifications);
      setUnreadCount(typeof unreadData === "object" ? unreadData.count : unreadData);
    } catch (error) {
      console.error("Failed to refresh notifications:", error);
    }
  };

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
        toast.success(`New Request: ${data.name || "Visitor"}`, {
          icon: "👤",
          duration: 5000,
        });

        sendNotification("New user is at the gate", {
          body: `${data.name || "A visitor"} is waiting for approval.`,
          tag: data.visit_id || data.id || data.name || "new-visitor-request",
          onClick: () => router.push("/approvals"),
        });

        // 🔥 SCOPED REFRESH
        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        refreshNotifications();
        if (onRefresh) onRefresh();
      },

      VISITOR_APPROVED: (data: any) => {
        triggerRefresh("visitors");
        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        refreshNotifications();
        if (onRefresh) onRefresh();
      },

      // Legacy or other event support
      visit_request: (data: any) => {
        toast.success(`Entry Request: ${data.name_snapshot || "Guest"}`, { icon: "🚗" });
        sendNotification("New user is at the gate", {
          body: `${data.name_snapshot || "A visitor"} is waiting for approval.`,
          tag: data.visit_id || data.id || data.name_snapshot || "visit-request",
          onClick: () => router.push("/approvals"),
        });
        triggerRefresh("dashboard");
        refreshNotifications();
        if (onRefresh) onRefresh();
      },
    },
  });

  return <>{children}</>;
}

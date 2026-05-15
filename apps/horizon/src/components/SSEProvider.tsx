/**
 * SSE Provider Component
 * Listens for real-time events and triggers UI updates
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSSE, safeString, type SSEEventData } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection, notificationsAPI } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";
import toast from "react-hot-toast";

interface SSEProviderProps {
  children: React.ReactNode;
  onRefresh?: () => void;
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
      const count =
        typeof unreadData === "object" && unreadData?.count ? unreadData.count : unreadData;
      if (typeof count === "number") {
        setUnreadCount(count);
      }
    } catch (error) {
      console.error("Failed to refresh notifications:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !hasFetchedInitial) {
      triggerRefresh("approvals");
      triggerRefresh("dashboard");
      triggerRefresh("visitors");
      setHasFetchedInitial(true);
    }
  }, [isAuthenticated, hasFetchedInitial, triggerRefresh]);

  useSSE({
    isAuthenticated: isAuthenticated && !!user,
    createConnection: createSSEConnection,
    handlers: {
      NEW_VISITOR_REQUEST: (data: SSEEventData) => {
        const visitorName = safeString(data, "name", "Visitor");
        const visitId = data?.visit_id || data?.id || data?.name || "new-visitor-request";

        toast.success(`New Request: ${visitorName}`, {
          icon: "👤",
          duration: 5000,
        });

        sendNotification("New user is at the gate", {
          body: `${visitorName} is waiting for approval.`,
          tag: String(visitId),
          onClick: () => router.push("/approvals"),
        });

        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        refreshNotifications();
        if (onRefresh) onRefresh();
      },

      new_visit_pending: (data: SSEEventData) => {
        const visitorName = safeString(data, "visitor_name", "Guest");
        const purpose = safeString(data, "purpose", "N/A");
        const visitId = data?.visit_id || data?.id || "new-visit-pending";

        toast.success(`New Visitor: ${visitorName}`, {
          icon: "🚪",
          duration: 5000,
        });

        sendNotification("New visitor at the gate", {
          body: `${visitorName} is waiting for approval. Purpose: ${purpose}`,
          tag: String(visitId),
          onClick: () => router.push("/approvals"),
        });

        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        refreshNotifications();
        if (onRefresh) onRefresh();
      },

      VISITOR_APPROVED: (data: SSEEventData) => {
        triggerRefresh("visitors");
        triggerRefresh("approvals");
        triggerRefresh("dashboard");
        refreshNotifications();
        if (onRefresh) onRefresh();
      },

      visit_request: (data: SSEEventData) => {
        const visitorName = safeString(data, "name_snapshot", "Guest");
        const visitId = data?.visit_id || data?.id || data?.name_snapshot || "visit-request";

        toast.success(`Entry Request: ${visitorName}`, { icon: "🚗" });
        sendNotification("New user is at the gate", {
          body: `${visitorName} is waiting for approval.`,
          tag: String(visitId),
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

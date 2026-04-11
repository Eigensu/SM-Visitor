/**
 * SSE Provider Component
 * Provides SSE connection to the entire app
 */
"use client";

import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection, notificationsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { useEffect } from "react";

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated,
    isAuthLoading,
    updateVisitStatus,
    addNotification,
    setNotifications,
    setUnreadCount,
  } = useStore();

  // Fetch initial notifications
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      try {
        const notifs = await notificationsAPI.getNotifications();
        const unreadRes = await notificationsAPI.getUnreadCount();
        setNotifications(notifs);
        setUnreadCount(unreadRes.count);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    if (isAuthenticated && !isAuthLoading) {
      fetchInitialNotifications();
    }
  }, [isAuthenticated, isAuthLoading, setNotifications, setUnreadCount]);

  // Check if SSE is enabled (can be disabled via env var for development)
  const sseEnabled = process.env.NEXT_PUBLIC_SSE_ENABLED !== "false";

  useSSE({
    // Only connect when auth is fully loaded, user is authenticated, and SSE is enabled
    isAuthenticated: isAuthenticated && !isAuthLoading && sseEnabled,
    createConnection: createSSEConnection,
    onEvent: (data) => {
      // Create a notification object from the event
      const newNotification = {
        id: Date.now().toString(), // Temporary ID for real-time
        title: "Notification",
        message: "New alert",
        type: data.type,
        created_at: new Date().toISOString(),
        is_read: false,
        data: data.data,
      };

      switch (data.type) {
        case "visit_approved":
          newNotification.title = "Visit Approved";
          newNotification.message = `Your visitor ${data.data.visitor_name} has been approved.`;
          updateVisitStatus(data.data.visit_id, "approved");
          toast.success(newNotification.message, { duration: 5000, icon: "✅" });
          addNotification(newNotification);
          break;

        case "visit_rejected":
          newNotification.title = "Visit Rejected";
          newNotification.message = `Your visitor ${data.data.visitor_name} was rejected.`;
          updateVisitStatus(data.data.visit_id, "rejected");
          toast.error(newNotification.message, { duration: 5000, icon: "❌" });
          addNotification(newNotification);
          break;

        case "new_user_registered":
          newNotification.title = "User Registration";
          newNotification.message = `New ${data.data.role} registered: ${data.data.name}`;
          toast.success(newNotification.message, { duration: 5000, icon: "👤" });
          addNotification(newNotification);
          break;

        default:
          console.log("Unknown SSE event type:", data.type);
          // Still add to notifications if it's not handled specifically but has a type
          if (data.type) {
            addNotification(newNotification);
          }
      }
    },
  });

  return <>{children}</>;
}

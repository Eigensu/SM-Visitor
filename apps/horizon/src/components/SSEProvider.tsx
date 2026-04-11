/**
 * SSE Provider Component
 * Provides SSE connection to the entire app
 */
"use client";

import { useSSE } from "@sm-visitor/hooks";
import { useStore } from "@/lib/store";
import { createSSEConnection, notificationsAPI } from "@/lib/api";
import { toast } from "sonner";
import { useEffect } from "react";

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, updateVisitStatus, addNotification, setNotifications, setUnreadCount } =
    useStore();

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

    if (isAuthenticated) {
      fetchInitialNotifications();
    }
  }, [isAuthenticated, setNotifications, setUnreadCount]);

  useSSE({
    isAuthenticated,
    createConnection: createSSEConnection,
    onEvent: (data) => {
      // Create a notification object from the event
      const newNotification = {
        id: Date.now().toString(),
        title: "Notification",
        message: "New alert",
        type: data.type,
        created_at: new Date().toISOString(),
        is_read: false,
        data: data.data,
      };

      switch (data.type) {
        case "new_visit_pending":
          newNotification.title = "Entry Request";
          newNotification.message = `New visitor ${data.data.visitor_name} is at the gate.`;
          toast.success(newNotification.title, {
            description: newNotification.message,
            icon: "🔔",
          });
          addNotification(newNotification);
          break;

        case "new_regular_visitor_pending":
          newNotification.title = "Staff Registration";
          newNotification.message = `Guard registered new staff: ${data.data.visitor_name}`;
          toast.success(newNotification.title, {
            description: newNotification.message,
            icon: "👤",
          });
          addNotification(newNotification);
          break;

        case "visit_auto_approved":
          // Sent when a regular/temp visitor uses a QR code
          toast.success(`${data.data.visitor_name} has entered`, {
            duration: 5000,
            icon: "🚪",
            description: "Entry via QR code",
          });
          break;

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

        case "new_user_registered":
          toast.success(`New ${data.data.role} registered: ${data.data.name}`, {
            duration: 5000,
            icon: "👤",
          });
          break;

        default:
          console.log("Unknown SSE event type:", data.type);
      }
    },
  });

  return <>{children}</>;
}

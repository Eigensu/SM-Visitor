/**
 * Notification Center Component
 * Includes the bell icon with badge and a dropdown list of recent alerts
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, XCircle, Clock, Check, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { notificationsAPI } from "@/lib/api";
import { Button } from "@sm-visitor/ui";
import { format } from "date-fns";

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, addNotification, setNotifications, clearUnreadCount } =
    useStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch persisted notifications on component mount
  // This ensures guards see notifications even after page refresh or SSE reconnect
  useEffect(() => {
    const fetchPersistedNotifications = async () => {
      try {
        const [persisted, unreadData] = await Promise.all([
          notificationsAPI.getNotifications(false), // Get all notifications
          notificationsAPI.getUnreadCount(),
        ]);

        // Merge with existing Zustand notifications, deduplicating by ID
        const existingIds = new Set(notifications.map((n) => n.id || n._id));
        const newNotifications = persisted.filter((n: any) => !existingIds.has(n.id || n._id));
        const merged = [...newNotifications, ...notifications];

        setNotifications(merged);
        const count = typeof unreadData === "object" ? unreadData.count : unreadData;
        if (typeof count === "number") {
          useStore.setState({ unreadCount: count });
        }
      } catch (error) {
        // Silent fail - persisted notifications are nice-to-have, not critical
        console.warn("Failed to fetch persisted notifications:", error);
      }
    };

    fetchPersistedNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      clearUnreadCount();
      // Update local state to mark all as read
      const updated = notifications.map((n) => ({ ...n, is_read: true }));
      setNotifications(updated);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "visit_approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "visit_rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "new_visit_pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-border bg-card shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary hover:text-primary/80"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/50 ${
                      !notif.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{getTypeIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight">
                        {notif.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-normal">
                        {notif.message}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {notif.created_at
                          ? format(new Date(notif.created_at), "h:mm a · MMM d")
                          : "Just now"}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-border bg-muted/30 p-2 text-center">
              <button
                onClick={() => router.push("/history")} // Fallback link
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                View full history
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

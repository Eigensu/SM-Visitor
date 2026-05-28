/**
 * Notification Center Component for Horizon
 * Includes the bell icon with badge and a dropdown list of recent alerts
 */
"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import type { AppNotification } from "@/lib/store";
import { notificationsAPI } from "@/lib/api";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { mergeNotifications } from "@sm-visitor/hooks";

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const router = useRouter();
  const { notifications, unreadCount, setNotifications, setUnreadCount, clearUnreadCount } =
    useStore();
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(384, window.innerWidth - 16);
      const desiredLeft = rect.right + 12;
      const maxLeft = window.innerWidth - menuWidth - 16;
      const left = Math.max(16, Math.min(desiredLeft, maxLeft));
      const top = Math.max(16, rect.top - 8);

      setMenuStyle({
        left,
        top,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  // Fetch persisted notifications on component mount
  // This ensures users see notifications even after page refresh or offline recovery
  useEffect(() => {
    const fetchPersistedNotifications = async () => {
      try {
        const [persisted, unreadData] = await Promise.all([
          notificationsAPI.getNotifications(false), // Get all, not just unread
          notificationsAPI.getUnreadCount(),
        ]);

        const persistedList = Array.isArray(persisted) ? (persisted as AppNotification[]) : [];
        const currentNotifications = useStore.getState().notifications;
        const merged = mergeNotifications(persistedList, currentNotifications) as AppNotification[];

        setNotifications(merged);
        const count = typeof unreadData === "object" ? unreadData.count : unreadData;
        if (typeof count === "number") {
          setUnreadCount(count);
        }
      } catch (error) {
        // Silent fail - persisted notifications are nice-to-have, not critical
        console.warn("Failed to fetch persisted notifications:", error);
      }
    };

    fetchPersistedNotifications();
  }, [setNotifications, setUnreadCount]);

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

  function handleNotificationClick(notif: AppNotification) {
    void (async () => {
      if (!notif.is_read) {
        try {
          const notificationId = notif._id || notif.id;
          if (!notificationId) {
            return;
          }

          await notificationsAPI.markAsRead(notificationId);
          // Update local state
          const updated = notifications.map((n) =>
            n._id === notif._id || n.id === notif.id ? { ...n, is_read: true } : n
          );
          setNotifications(updated);
          // Decrement count locally? Store already has logic but simple set is safer
          useStore.setState((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) }));
        } catch (e) {
          console.error("Failed to mark as read:", e);
        }
      }

      // Navigation logic
      if (notif.type === "new_visit_pending") {
        router.push("/approvals");
        setIsOpen(false);
      }
    })();
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "visit_approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "visit_rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "new_visit_pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "visit_auto_approved":
        return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-slate-400" />;
    }
  }

  const dropdown = isOpen ? (
    <div
      ref={menuRef}
      style={menuStyle ?? undefined}
      className="fixed z-[9999] w-[calc(100vw-2rem)] max-w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-slate-800 dark:bg-slate-950 sm:w-80 lg:w-96"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-primary hover:text-primary/80"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-[450px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Bell className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No notifications yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              We'll notify you when visitors arrive or requests are processed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((notif) => (
              <div
                key={notif._id || notif.id || `${notif.type}-${notif.created_at}`}
                onClick={() => handleNotificationClick(notif)}
                className={`flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                  !notif.is_read ? "bg-primary/5 dark:bg-primary/10" : ""
                }`}
              >
                <div className="mt-1 flex-shrink-0">{getTypeIcon(notif.type)}</div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-tight ${notif.is_read ? "text-slate-600 dark:text-slate-400" : "font-bold text-slate-900 dark:text-white"}`}
                  >
                    {notif.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-normal text-slate-500 dark:text-slate-400">
                    {notif.message}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-tight text-slate-400">
                      {notif.created_at
                        ? format(new Date(notif.created_at), "h:mm a · MMM d")
                        : "Just now"}
                    </span>
                    {!notif.is_read && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-2 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-[11px] font-bold text-slate-500">LATEST UPDATES</span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative" ref={triggerRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {typeof document !== "undefined" && isOpen ? createPortal(dropdown, document.body) : dropdown}
    </div>
  );
}

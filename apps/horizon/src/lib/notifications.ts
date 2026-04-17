/**
 * Browser Push Notification utilities
 * Uses the Web Notifications API for OS-level popups
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
};

export const isNotificationSupported = () => "Notification" in window;

export const getNotificationPermission = () =>
  "Notification" in window ? Notification.permission : "denied";

export const sendNotification = (
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    onClick?: () => void;
  }
) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body: options?.body,
    icon: options?.icon || "/logo.png",
    badge: options?.badge || "/logo.png",
    tag: options?.tag,
  });

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto-close after 8 seconds
  setTimeout(() => notification.close(), 8000);

  return notification;
};

/**
 * SSE Event Handler Utilities
 * Provides reusable, typed SSE event handlers with proper error handling
 * and defensive null-coalescing patterns
 */

export interface SSEEventData {
  [key: string]: any;
}

export type NormalizedApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "auto_approved"
  | "deleted";

export interface NormalizedNotification {
  id: string;
  _id: string;
  type: string;
  title: string;
  message: string;
  body: string;
  text: string;
  created_at: string;
  is_read: boolean;
  data?: SSEEventData;
}

export interface NormalizedVisitRecord extends SSEEventData {
  id: string;
  _id: string;
  visitor_id?: string | null;
  approval_status?: NormalizedApprovalStatus;
  status: NormalizedApprovalStatus;
  created_at: string;
  updated_at?: string | null;
}

export interface NormalizedRegularVisitorRecord extends SSEEventData {
  id: string;
  _id: string;
  approval_status: NormalizedApprovalStatus;
  created_at: string;
  visitor_id?: string | null;
}

export interface SSEEventHandler {
  (data: SSEEventData): void | Promise<void>;
}

/**
 * Safely extract string data from SSE payload
 * @param data - SSE event data
 * @param key - Key to extract
 * @param fallback - Default value if key is missing or null
 */
export const safeString = (
  data: SSEEventData,
  key: string,
  fallback: string = "Unknown"
): string => {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

/**
 * Safely extract ID from SSE payload
 * Supports both _id (MongoDB) and id formats
 */
export const safeId = (data: SSEEventData): string | null => {
  return data?._id || data?.id || data?.visit_id || null;
};

export const normalizeId = (value: unknown): string => {
  return typeof value === "string" && value.trim() ? value.trim() : "";
};

export const normalizeApprovalStatus = (
  status: unknown,
  fallback: NormalizedApprovalStatus = "pending"
): NormalizedApprovalStatus => {
  if (typeof status === "string") {
    const normalized = status.trim().toLowerCase();
    if (
      normalized === "pending" ||
      normalized === "approved" ||
      normalized === "rejected" ||
      normalized === "auto_approved" ||
      normalized === "deleted"
    ) {
      return normalized;
    }
  }

  if (status && typeof status === "object" && "value" in (status as Record<string, unknown>)) {
    return normalizeApprovalStatus((status as { value?: unknown }).value, fallback);
  }

  return fallback;
};

const normalizeDateString = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  return value.trim();
};

export const normalizeNotification = (notification: any): NormalizedNotification => {
  const id = normalizeId(notification?._id || notification?.id || notification?.notification_id);
  const title = typeof notification?.title === "string" ? notification.title : "Notification";
  const messageCandidate =
    typeof notification?.message === "string"
      ? notification.message
      : typeof notification?.body === "string"
        ? notification.body
        : typeof notification?.text === "string"
          ? notification.text
          : "";
  const createdAt = normalizeDateString(notification?.created_at || notification?.timestamp);

  return {
    id,
    _id: id,
    type: typeof notification?.type === "string" ? notification.type : "general",
    title,
    message: messageCandidate || title,
    body: messageCandidate || title,
    text: messageCandidate || title,
    created_at: createdAt,
    is_read: Boolean(notification?.is_read ?? notification?.read ?? false),
    data: notification?.data,
  };
};

export const normalizeVisitRecord = (visit: any): NormalizedVisitRecord => {
  const id = normalizeId(visit?._id || visit?.id || visit?.visit_id);
  const status = normalizeApprovalStatus(visit?.status);
  return {
    ...visit,
    id,
    _id: id,
    visitor_id: normalizeId(visit?.visitor_id) || null,
    status,
    approval_status: normalizeApprovalStatus(visit?.approval_status, status),
    created_at: normalizeDateString(visit?.created_at),
    updated_at: visit?.updated_at ? normalizeDateString(visit.updated_at) : null,
  };
};

export const normalizeRegularVisitorRecord = (visitor: any): NormalizedRegularVisitorRecord => {
  const id = normalizeId(visitor?._id || visitor?.id || visitor?.visitor_id);
  const approvalStatus = normalizeApprovalStatus(visitor?.approval_status);
  return {
    ...visitor,
    id,
    _id: id,
    visitor_id: id,
    approval_status: approvalStatus,
    created_at: normalizeDateString(visitor?.created_at),
  };
};

export const normalizeVisitList = (items: any[] = []) => items.map(normalizeVisitRecord);
export const normalizeRegularVisitorList = (items: any[] = []) =>
  items.map(normalizeRegularVisitorRecord);
export const normalizeNotificationList = (items: any[] = []) => items.map(normalizeNotification);

/**
 * Safely extract ISO datetime from SSE payload
 */
export const safeIsoDateTime = (data: SSEEventData, key: string): string | null => {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
};

/**
 * Create a validated SSE event handler with error boundaries
 * Prevents a single event from crashing the entire SSE system
 */
export const createSafeHandler = (handler: SSEEventHandler, eventName: string): SSEEventHandler => {
  return async (data: SSEEventData) => {
    try {
      if (!data || typeof data !== "object") {
        console.warn(`[SSE] Invalid event data for ${eventName}:`, data);
        return;
      }
      await handler(data);
    } catch (error) {
      console.error(`[SSE] Error handling event ${eventName}:`, error);
      // Do NOT rethrow - allow other handlers to continue
    }
  };
};

/**
 * Create a handler that triggers store refresh with debouncing
 * Prevents excessive re-renders from rapid SSE events
 */
export const createRefreshHandler = (
  triggerRefresh: (scope: string) => void,
  refreshScopes: string[],
  onCustom?: (data: SSEEventData) => void | Promise<void>
): SSEEventHandler => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return async (data: SSEEventData) => {
    try {
      // Clear pending refresh
      if (timeoutId) clearTimeout(timeoutId);

      // Run custom handler if provided
      if (onCustom) {
        await onCustom(data);
      }

      // Batch refresh triggers into a single microtask
      timeoutId = setTimeout(() => {
        refreshScopes.forEach((scope) => triggerRefresh(scope));
        timeoutId = null;
      }, 50); // 50ms debounce
    } catch (error) {
      console.error("[SSE] Error in refresh handler:", error);
    }
  };
};

/**
 * Create a handler that validates data and shows a toast
 * Used for user-facing notifications
 */
export const createToastHandler = (
  toastFn: (message: string, icon: string, duration?: number) => void,
  formatMessage: (data: SSEEventData) => string,
  icon: string = "🔔",
  duration: number = 5000
): SSEEventHandler => {
  return async (data: SSEEventData) => {
    try {
      const message = formatMessage(data);
      if (message) {
        toastFn(message, icon, duration);
      }
    } catch (error) {
      console.error("[SSE] Error showing toast:", error);
    }
  };
};

/**
 * Merge SSE-received notifications with existing ones
 * Removes duplicates based on ID
 */
export const mergeNotifications = (incoming: any[], existing: any[]): any[] => {
  const normalizedIncoming = normalizeNotificationList(incoming);
  const normalizedExisting = normalizeNotificationList(existing);
  const existingIds = new Set(normalizedExisting.map((n) => n.id));
  const newNotifications = normalizedIncoming.filter((n) => !existingIds.has(n.id));
  return [...newNotifications, ...normalizedExisting];
};

/**
 * Validate SSE connection health
 * Guards against stale or broken connections
 */
export const isValidSSEConnection = (eventSource: EventSource | null): boolean => {
  if (!eventSource) return false;
  // EventSource.readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
  return eventSource.readyState === EventSource.OPEN;
};

/**
 * SSE Event Handler Utilities
 * Provides reusable, typed SSE event handlers with proper error handling
 * and defensive null-coalescing patterns
 */

export interface SSEEventData {
  [key: string]: any;
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
  const existingIds = new Set(existing.map((n) => n._id || n.id));
  const newNotifications = incoming.filter((n) => !existingIds.has(n._id || n.id));
  return [...newNotifications, ...existing];
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

/**
 * @sm-visitor/hooks
 * Shared React hooks for SM-Visitor apps
 */

export { useSSE, type SSEConfig } from "./useSSE";
export {
  safeString,
  safeId,
  safeIsoDateTime,
  createSafeHandler,
  createRefreshHandler,
  createToastHandler,
  mergeNotifications,
  isValidSSEConnection,
  type SSEEventData,
  type SSEEventHandler,
} from "./useSSEEventHandlers";

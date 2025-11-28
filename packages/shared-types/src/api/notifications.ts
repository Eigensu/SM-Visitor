import { SSEEventType } from "../enums";
import { Visit } from "../models/visit";

/**
 * SSE Event structure
 */
export interface SSEEvent {
  type: SSEEventType;
  data: Visit;
  timestamp: Date;
}

/**
 * SSE Event payload for different event types
 */
export type SSEEventPayload =
  | { type: SSEEventType.NEW_VISIT_PENDING; data: Visit }
  | { type: SSEEventType.VISIT_APPROVED; data: Visit }
  | { type: SSEEventType.VISIT_REJECTED; data: Visit }
  | { type: SSEEventType.VISIT_AUTO_APPROVED; data: Visit };

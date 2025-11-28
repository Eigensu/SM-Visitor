/**
 * User roles in the system
 */
export enum UserRole {
  OWNER = "owner",
  GUARD = "guard",
  ADMIN = "admin",
}

/**
 * Types of visitors
 */
export enum VisitorType {
  REGULAR = "regular",
  NEW = "new",
  TEMPORARY = "temporary",
}

/**
 * Visit status states
 */
export enum VisitStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  AUTO_APPROVED = "auto_approved",
}

/**
 * SSE event types for real-time notifications
 */
export enum SSEEventType {
  NEW_VISIT_PENDING = "new_visit_pending",
  VISIT_APPROVED = "visit_approved",
  VISIT_REJECTED = "visit_rejected",
  VISIT_AUTO_APPROVED = "visit_auto_approved",
}

/**
 * QR token types
 */
export enum QRTokenType {
  REGULAR = "regular",
  TEMPORARY = "temporary",
}

import { VisitStatus } from "../enums";

/**
 * Visit model representing each entry event
 */
export interface Visit {
  _id: string;
  visitor_id?: string; // Nullable for temporary passes
  name_snapshot: string;
  phone_snapshot?: string;
  photo_snapshot_url: string;
  purpose: string;
  owner_id: string;
  guard_id: string;
  entry_time?: Date;
  exit_time?: Date;
  status: VisitStatus;
  qr_token?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Start visit via QR scan
 */
export interface StartVisitQRInput {
  qr_token: string;
  owner_id: string;
  purpose?: string;
}

/**
 * Start visit for new visitor
 */
export interface StartVisitNewInput {
  name: string;
  phone?: string;
  photo_url: string;
  owner_id: string;
  purpose: string;
}

/**
 * QR scan validation response
 */
export interface QRScanResponse {
  valid: boolean;
  auto_approve: boolean;
  visitor_data?: {
    name: string;
    phone?: string;
    photo_url: string;
    purpose?: string;
    visitor_type: string;
  };
  error?: string;
}

/**
 * Visit list query params
 */
export interface VisitQueryParams {
  guard_id?: string;
  owner_id?: string;
  status?: VisitStatus;
  date?: string; // ISO date string
}

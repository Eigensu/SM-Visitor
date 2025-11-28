import { VisitorType } from "../enums";

/**
 * Visitor model for regular and new visitors
 */
export interface Visitor {
  _id: string;
  name: string;
  phone?: string;
  photo_url: string;
  visitor_type: VisitorType;
  created_by: string; // User ID (owner/admin)
  default_purpose?: string;
  qr_token?: string; // For regular visitors
  qr_expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  metadata?: Record<string, any>;
}

/**
 * Create regular visitor payload
 */
export interface CreateRegularVisitorInput {
  name: string;
  phone?: string;
  photo_url: string;
  default_purpose?: string;
  owner_id: string;
}

/**
 * Update visitor payload
 */
export interface UpdateVisitorInput {
  name?: string;
  phone?: string;
  photo_url?: string;
  default_purpose?: string;
  is_active?: boolean;
}

/**
 * Visitor with QR response
 */
export interface VisitorWithQR extends Visitor {
  qr_image_url: string;
}

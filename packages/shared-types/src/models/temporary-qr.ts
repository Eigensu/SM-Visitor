/**
 * Temporary QR model for one-time guest passes
 */
export interface TemporaryQR {
  _id: string;
  owner_id: string;
  guest_name?: string;
  token: string;
  expires_at: Date;
  one_time: boolean;
  used_at?: Date;
  created_at: Date;
}

/**
 * Generate temporary QR input
 */
export interface GenerateTemporaryQRInput {
  guest_name?: string;
  validity_hours: number;
}

/**
 * Temporary QR response with QR image
 */
export interface TemporaryQRResponse {
  temp_qr: TemporaryQR;
  qr_image_url: string;
}

/**
 * Validate temporary QR response
 */
export interface ValidateTemporaryQRResponse {
  valid: boolean;
  owner_id?: string;
  guest_name?: string;
  expires_at?: Date;
  error?: string;
}

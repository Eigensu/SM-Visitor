import { UserRole } from "../enums";

/**
 * User model representing guards, owners, and admins
 */
export interface User {
  _id: string;
  name: string;
  phone: string;
  role: UserRole;
  flat_id?: string; // Optional, for owners
  otp_code?: string; // Temporary OTP storage
  otp_expires_at?: Date;
  last_seen?: Date;
  created_at: Date;
  metadata?: Record<string, any>;
}

/**
 * User creation payload (without system-generated fields)
 */
export interface CreateUserInput {
  name: string;
  phone: string;
  role: UserRole;
  flat_id?: string;
}

/**
 * User update payload
 */
export interface UpdateUserInput {
  name?: string;
  flat_id?: string;
  metadata?: Record<string, any>;
}

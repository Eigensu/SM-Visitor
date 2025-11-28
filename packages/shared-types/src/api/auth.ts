import { User } from "../models/user";

/**
 * Login request (send OTP)
 */
export interface LoginRequest {
  phone: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  success: boolean;
  message: string;
}

/**
 * Verify OTP request
 */
export interface VerifyOTPRequest {
  phone: string;
  otp: string;
}

/**
 * Verify OTP response
 */
export interface VerifyOTPResponse {
  token: string;
  user: User;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  user_id: string;
  role: string;
  flat_id?: string;
  iat?: number;
  exp?: number;
}

/**
 * Standard API error response
 */
export interface APIError {
  error: string;
  code: string;
  details?: Record<string, any>;
}

/**
 * Standard API success response
 */
export interface APISuccess<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

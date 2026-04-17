/**
 * API Client for Horizon Owner App
 * Handles all HTTP requests to the Pantry backend
 */
import axios, { AxiosInstance, AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {},
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Silently ignore canceled requests (AbortController)
    if (error.code === "ERR_CANCELED" || axios.isCancel(error)) {
      return Promise.reject(error);
    }

    console.error("API Error Interceptor:", error.message, error.response?.status);

    // Only redirect to login for 401 errors that are NOT from the login endpoint
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: async (data: {
    phone: string;
    password: string;
    name: string;
    role: string;
    flat_id?: string;
  }) => {
    const response = await apiClient.post("/auth/signup", data);
    return response.data;
  },

  login: async (phone: string, password: string) => {
    const response = await apiClient.post("/auth/login", { phone, password });
    return response.data;
  },

  me: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
};

// Visits API
export const visitsAPI = {
  getPending: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/pending", { signal });
    return response.data;
  },

  getPendingCount: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/pending/count", { signal });
    return response.data.count;
  },

  getTodayCount: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/today/count", { signal });
    return response.data.count;
  },

  approve: async (visitId: string) => {
    const response = await apiClient.patch(`/visits/${visitId}/approve`);
    return response.data;
  },

  reject: async (visitId: string, reason?: string) => {
    const response = await apiClient.patch(`/visits/${visitId}/reject`, { reason });
    return response.data;
  },

  getRecentActivity: async (limit: number = 10, signal?: AbortSignal) => {
    const response = await apiClient.get(`/visits/recent?limit=${limit}`, { signal });
    return response.data;
  },

  getVisitDetails: async (visitId: string, signal?: AbortSignal) => {
    const response = await apiClient.get(`/visits/${visitId}`, { signal });
    return response.data;
  },

  getHistory: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/history", { signal });
    return response.data;
  },

  getNotifications: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/notifications", { signal });
    return response.data;
  },

  getDashboardStats: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/stats/summary", { signal });
    const data = response.data;
    return {
      todayCount: data.today_count,
      pendingCount: data.pending_count,
      pendingAdhocCount: data.pending_adhoc_count,
      pendingStaffCount: data.pending_staff_count,
      approvedCount: data.approved_count,
      activeQrCount: data.active_qr_count,
    };
  },

  getWeeklyStats: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/stats/weekly", { signal });
    return response.data;
  },
};

// Regular Visitors API
export const visitorsAPI = {
  getRegularVisitors: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visitors/regular", { signal });
    return response.data;
  },

  getPendingRegular: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visitors/approvals/regular", { signal });
    return response.data;
  },

  getHistoryRegular: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visitors/history/regular", { signal });
    return response.data;
  },

  approveRegular: async (visitorId: string) => {
    const response = await apiClient.patch(`/visitors/${visitorId}/approve-regular`);
    return response.data;
  },

  rejectRegular: async (visitorId: string) => {
    const response = await apiClient.patch(`/visitors/${visitorId}/reject-regular`);
    return response.data;
  },

  getRegularCount: async () => {
    const response = await apiClient.get("/visitors/regular/count");
    return response.data.count;
  },

  createRegular: async (data: {
    name: string;
    phone: string;
    photo_id: string;
    default_purpose: string;
    category?: string;
    schedule_enabled?: boolean;
    schedule_days?: number[];
    schedule_start_time?: string;
    schedule_end_time?: string;
    auto_approval_enabled?: boolean;
    auto_approval_rule?: string;
    is_all_flats?: boolean;
    valid_flats?: string[];
  }) => {
    const response = await apiClient.post("/visitors/regular", data);
    return response.data;
  },

  deleteRegularVisitor: async (visitorId: string) => {
    const response = await apiClient.delete(`/visitors/regular/${visitorId}`);
    return response.data;
  },
};

// Temporary QR API
export const tempQRAPI = {
  generate: async (data: {
    guest_name?: string;
    validity_hours: number;
    is_all_flats?: boolean;
    valid_flats?: string[];
  }) => {
    const response = await apiClient.post("/temp-qr/generate", data);
    return response.data;
  },

  getActive: async () => {
    const response = await apiClient.get("/temp-qr/active");
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async (unreadOnly: boolean = false) => {
    const response = await apiClient.get(`/notifications?unread_only=${unreadOnly}`);
    return response.data;
  },
  getUnreadCount: async () => {
    const response = await apiClient.get("/notifications/unread/count");
    return response.data;
  },
  markAsRead: async (id: string) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },
  markAllAsRead: async () => {
    const response = await apiClient.post("/notifications/read-all");
    return response.data;
  },
};

// Uploads API
export const uploadsAPI = {
  uploadRegularVisitorPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post("/uploads/photo/regular-visitor", formData);
    return response.data;
  },
};

// SSE Connection
export const createSSEConnection = () => {
  const token = localStorage.getItem("auth_token");
  console.log("Initializing SSE... checking token:", !!token);
  if (!token) return null;

  try {
    const url = `${API_URL}/events/stream?token=${token}`;
    console.log("Creating EventSource to:", url.split("?")[0]);
    return new EventSource(url, {
      withCredentials: false,
    });
  } catch (error) {
    console.error("Failed to create SSE connection:", error);
    return null;
  }
};

export default apiClient;

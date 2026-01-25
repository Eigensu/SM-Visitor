/**
 * API Client for Horizon Owner App
 * Handles all HTTP requests to the Pantry backend
 */
import axios, { AxiosInstance, AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
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
    console.error("API Error Interceptor:", error.message, error.response?.status);
    if (error.response?.status === 401) {
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
  getPending: async () => {
    const response = await apiClient.get("/visits/pending");
    return response.data;
  },

  getPendingCount: async () => {
    const response = await apiClient.get("/visits/pending/count");
    return response.data.count;
  },

  getTodayCount: async () => {
    const response = await apiClient.get("/visits/today/count");
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

  getRecent: async (limit: number = 10) => {
    const response = await apiClient.get(`/visits/recent?limit=${limit}`);
    return response.data;
  },

  getRecentActivity: async (limit: number = 10) => {
    const response = await apiClient.get(`/visits/recent?limit=${limit}`);
    return response.data;
  },

  getHistory: async (limit: number = 100) => {
    const response = await apiClient.get(`/visits/recent?limit=${limit}`);
    return response.data;
  },

  getNotifications: async () => {
    const response = await apiClient.get("/visits/notifications");
    return response.data;
  },

  getDashboardStats: async () => {
    const response = await apiClient.get("/visits/stats/summary");
    return response.data;
  },

  getWeeklyStats: async () => {
    const response = await apiClient.get("/visits/stats/weekly");
    return response.data;
  },
};

// Regular Visitors API
export const visitorsAPI = {
  getRegular: async () => {
    const response = await apiClient.get("/visitors/regular");
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
  }) => {
    const response = await apiClient.post("/visitors/regular", data);
    return response.data;
  },

  deleteRegular: async (visitorId: string) => {
    const response = await apiClient.delete(`/visitors/regular/${visitorId}`);
    return response.data;
  },
};

// Temporary QR API
export const tempQRAPI = {
  generate: async (data: { guest_name?: string; validity_hours: number }) => {
    const response = await apiClient.post("/temp-qr/generate", data);
    return response.data;
  },
};

// Uploads API
export const uploadsAPI = {
  uploadRegularVisitorPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post("/uploads/photo/regular-visitor", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

// SSE Connection
export const createSSEConnection = (onEvent: (event: MessageEvent) => void) => {
  const token = localStorage.getItem("auth_token");
  if (!token) return null;

  const eventSource = new EventSource(`${API_URL}/events/stream?token=${token}`, {
    withCredentials: false,
  });

  eventSource.onmessage = onEvent;

  eventSource.onerror = (error) => {
    console.error("SSE Error:", error);
    eventSource.close();
  };

  return eventSource;
};

export default apiClient;

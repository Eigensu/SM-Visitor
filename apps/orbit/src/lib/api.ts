/**
 * API Client for Orbit Guard App
 * Handles all HTTP requests to the Pantry backend
 */
import axios, { AxiosInstance, AxiosError } from "axios";
import {
  normalizeNotificationList,
  normalizeRegularVisitorList,
  normalizeVisitList,
  normalizeVisitRecord,
} from "@sm-visitor/hooks";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const isBrowser = typeof window !== "undefined";

const getAuthToken = (): string | null => {
  if (!isBrowser) return null;
  return localStorage.getItem("auth_token");
};

const clearAuthStorage = () => {
  if (!isBrowser) return;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {},
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
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
    console.log("API interceptor caught error:", error.response?.status, error.config?.url);

    if (error.response?.status === 401) {
      // Don't redirect if this is a login attempt - let the login page handle the error
      const isLoginAttempt = error.config?.url?.includes("/auth/login");
      console.log("Is login attempt:", isLoginAttempt);

      if (!isLoginAttempt) {
        console.log("Redirecting to login due to 401");
        // Unauthorized - clear token and redirect to login
        clearAuthStorage();
        if (isBrowser) {
          window.location.href = "/login";
        }
      } else {
        console.log("Skipping redirect for login attempt");
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
  scanQR: async (qr_token: string) => {
    const response = await apiClient.post("/visits/qr-scan", { qr_token });
    return response.data;
  },

  startVisit: async (data: {
    qr_token?: string;
    owner_id?: string;
    purpose?: string;
    name?: string;
    phone?: string;
    photo_url?: string;
    id_type?: string;
    id_number?: string;
    id_photo_url?: string;
  }) => {
    const payload = data.qr_token
      ? {
          qr_request: {
            qr_token: data.qr_token,
            owner_id: data.owner_id,
            purpose: data.purpose,
          },
        }
      : {
          new_request: {
            name: data.name,
            phone: data.phone,
            photo_url: data.photo_url,
            owner_id: data.owner_id,
            purpose: data.purpose,
            id_type: data.id_type,
            id_number: data.id_number,
            id_photo_url: data.id_photo_url,
          },
        };

    const response = await apiClient.post("/visits/start", payload);
    return response.data;
  },

  getTodayVisits: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visits/today", { signal });
    return normalizeVisitList(response.data);
  },

  getVisit: async (visitId: string, signal?: AbortSignal) => {
    const response = await apiClient.get(`/visits/${visitId}`, { signal });
    return normalizeVisitRecord(response.data);
  },

  checkout: async (visitId: string) => {
    const response = await apiClient.patch(`/visits/${visitId}/checkout`);
    return response.data;
  },

  cancelVisit: async (visitId: string) => {
    const response = await apiClient.delete(`/visits/${visitId}`);
    return response.data;
  },
};

// Regular Visitors API
export const visitorsAPI = {
  createRegularByGuard: async (data: FormData) => {
    const response = await apiClient.post("/visitors/regular/guard", data);
    return response.data;
  },
  list: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visitors/", { signal });
    return normalizeRegularVisitorList(response.data);
  },
  getAllVisitors: async (signal?: AbortSignal) => {
    const response = await apiClient.get("/visitors/", { signal });
    return normalizeRegularVisitorList(response.data);
  },
  deleteRegular: async (visitorId: string) => {
    const response = await apiClient.delete(`/visitors/${visitorId}`);
    return response.data;
  },
};

// Uploads API
export const uploadsAPI = {
  uploadNewVisitorPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post("/uploads/photo/new-visitor", formData);
    return response.data;
  },

  uploadRegularVisitorPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post("/uploads/photo/regular-visitor", formData);
    return response.data;
  },

  uploadIDCardPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post("/uploads/photo/id-card", formData);
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getOwners: async () => {
    const response = await apiClient.get("/users/?role=owner");
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async (unreadOnly: boolean = false) => {
    const response = await apiClient.get(`/notifications?unread_only=${unreadOnly}`);
    return normalizeNotificationList(response.data);
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

// SSE Connection
export const createSSEConnection = () => {
  if (!isBrowser || typeof EventSource === "undefined") return null;

  const token = getAuthToken();
  if (!token || token === "undefined") {
    console.log("No auth token available for SSE connection");
    return null;
  }

  console.log("Creating SSE connection...");

  try {
    return new EventSource(`${API_URL}/events/stream?token=${encodeURIComponent(token)}`, {
      withCredentials: false,
    });
  } catch (error) {
    console.error("Failed to create SSE connection:", error);
    return null;
  }
};

export default apiClient;

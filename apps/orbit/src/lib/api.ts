/**
 * API Client for Orbit Guard App
 * Handles all HTTP requests to the Pantry backend
 */
import axios, { AxiosInstance, AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
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
    username: string;
    password: string;
    name: string;
    role: string;
    flat_id?: string;
  }) => {
    const response = await apiClient.post("/auth/signup", data);
    return response.data;
  },

  login: async (username: string, password: string) => {
    const response = await apiClient.post("/auth/login", { username, password });
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
  }) => {
    const response = await apiClient.post("/visits/start", data);
    return response.data;
  },

  getTodayVisits: async () => {
    const response = await apiClient.get("/visits/today");
    return response.data;
  },

  checkout: async (visitId: string) => {
    const response = await apiClient.patch(`/visits/${visitId}/checkout`);
    return response.data;
  },
};

// Uploads API
export const uploadsAPI = {
  uploadNewVisitorPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post("/uploads/photo/new-visitor", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getOwners: async () => {
    const response = await apiClient.get("/users?role=owner");
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

/**
 * API Client for Orbit Guard App
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
    console.log("API interceptor caught error:", error.response?.status, error.config?.url);

    if (error.response?.status === 401) {
      // Don't redirect if this is a login attempt - let the login page handle the error
      const isLoginAttempt = error.config?.url?.includes("/auth/login");
      console.log("Is login attempt:", isLoginAttempt);

      if (!isLoginAttempt) {
        console.log("Redirecting to login due to 401");
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        if (typeof window !== "undefined") {
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
  }) => {
    // Construct payload based on whether it's a QR scan or new visitor
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
          },
        };

    const response = await apiClient.post("/visits/start", payload);
    return response.data;
  },

  getTodayVisits: async () => {
    const response = await apiClient.get("/visits/today");
    return response.data;
  },

  getVisit: async (visitId: string) => {
    const response = await apiClient.get(`/visits/${visitId}`);
    return response.data;
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

// Visitors API
export const visitorsAPI = {
  getRegularVisitors: async () => {
    const response = await apiClient.get("/visitors/regular");
    return response.data;
  },
  getAllVisitors: async () => {
    const response = await apiClient.get("/visitors/");
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
    const response = await apiClient.get("/users/?role=owner");
    return response.data;
  },
};

// SSE Connection
export const createSSEConnection = (onEvent: (event: MessageEvent) => void) => {
  const token = localStorage.getItem("auth_token");
  if (!token || token === "undefined") {
    console.log("No auth token available for SSE connection");
    return null;
  }

  console.log("Creating SSE connection...");

  try {
    const eventSource = new EventSource(`${API_URL}/events/stream?token=${token}`, {
      withCredentials: false,
    });

    eventSource.onopen = () => {
      console.log("SSE connection established");
    };

    eventSource.onmessage = onEvent;

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      // Don't close here - let the useSSE hook handle reconnection
    };

    return eventSource;
  } catch (error) {
    console.error("Failed to create SSE connection:", error);
    return null;
  }
};

export default apiClient;

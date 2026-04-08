/**
 * Global State Management using Zustand
 */
import { create } from "zustand";

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  created_at: string;
}

interface Visit {
  id: string;
  visitor_id?: string;
  name_snapshot: string;
  phone_snapshot?: string;
  photo_snapshot_url: string;
  purpose: string;
  owner_id: string;
  guard_id: string;
  entry_time?: string;
  exit_time?: string;
  status: "pending" | "approved" | "rejected" | "auto_approved";
  created_at: string;
}

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean; // New loading state for auth initialization

  // Visits
  pendingVisits: Visit[];
  todayVisits: Visit[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setAuthLoading: (loading: boolean) => void;
  setPendingVisits: (visits: Visit[]) => void;
  setTodayVisits: (visits: Visit[]) => void;
  addPendingVisit: (visit: Visit) => void;
  addVisit: (visit: Visit) => void;
  updateVisitStatus: (visitId: string, status: Visit["status"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  isAuthLoading: true, // Start with loading true
  pendingVisits: [],
  todayVisits: [],
  isLoading: false,
  error: null,

  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
    set({ token });
  },

  login: (user, token) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isAuthLoading: false });
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    set({ user: null, token: null, isAuthenticated: false, isAuthLoading: false });
  },

  setAuthLoading: (loading) => set({ isAuthLoading: loading }),

  setPendingVisits: (visits) => set({ pendingVisits: visits }),

  // Sync pending visits when setting today's visits
  setTodayVisits: (visits) =>
    set({
      todayVisits: visits,
      pendingVisits: visits.filter((v) => v.status === "pending"),
    }),

  addPendingVisit: (visit) =>
    set((state) => ({
      pendingVisits: [...state.pendingVisits, visit],
      todayVisits: [...state.todayVisits, visit],
    })),

  addVisit: (visit: Visit) =>
    set((state) => {
      // Avoid duplicates
      if (state.todayVisits.some((v) => v.id === visit.id)) {
        return state;
      }

      const newPending =
        visit.status === "pending" ? [...state.pendingVisits, visit] : state.pendingVisits;

      return {
        todayVisits: [visit, ...state.todayVisits], // Add to top
        pendingVisits: newPending,
      };
    }),

  updateVisitStatus: (visitId, status) =>
    set((state) => {
      console.log("🔄 Updating visit status:", {
        visitId,
        status,
        currentTodayVisits: state.todayVisits.length,
      });

      const updatedPending = state.pendingVisits.map((v) =>
        v.id === visitId ? { ...v, status } : v
      );

      const updatedToday = state.todayVisits.map((v) => (v.id === visitId ? { ...v, status } : v));

      console.log("✅ Updated arrays:", {
        pendingChanged: updatedPending !== state.pendingVisits,
        todayChanged: updatedToday !== state.todayVisits,
        updatedTodayCount: updatedToday.length,
      });

      return {
        pendingVisits: updatedPending,
        todayVisits: updatedToday,
      };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));

// Initialize auth state from localStorage on app load
if (typeof window !== "undefined") {
  const initializeAuth = () => {
    try {
      const token = localStorage.getItem("auth_token");
      const userStr = localStorage.getItem("user");

      if (token && userStr && token !== "undefined" && userStr !== "undefined") {
        const user = JSON.parse(userStr);
        console.log("Restoring auth state:", { user, token: token.substring(0, 20) + "..." });

        useStore.setState({
          user,
          token,
          isAuthenticated: true,
          isAuthLoading: false,
        });
      } else {
        console.log("No valid auth state found in localStorage");
        // Clean up any invalid tokens
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        useStore.setState({
          isAuthLoading: false,
        });
      }
    } catch (error) {
      console.error("Failed to restore auth state:", error);
      // Clean up corrupted data
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      useStore.setState({
        isAuthLoading: false,
      });
    }
  };

  // Initialize immediately
  initializeAuth();
}

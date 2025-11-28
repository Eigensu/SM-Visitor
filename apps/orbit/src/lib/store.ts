/**
 * Global State Management using Zustand
 */
import { create } from "zustand";

interface User {
  _id: string;
  name: string;
  phone: string;
  role: string;
  created_at: string;
}

interface Visit {
  _id: string;
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
  setPendingVisits: (visits: Visit[]) => void;
  setTodayVisits: (visits: Visit[]) => void;
  addPendingVisit: (visit: Visit) => void;
  updateVisitStatus: (visitId: string, status: Visit["status"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
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
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    set({ user: null, token: null, isAuthenticated: false });
  },

  setPendingVisits: (visits) => set({ pendingVisits: visits }),

  setTodayVisits: (visits) => set({ todayVisits: visits }),

  addPendingVisit: (visit) =>
    set((state) => ({
      pendingVisits: [...state.pendingVisits, visit],
    })),

  updateVisitStatus: (visitId, status) =>
    set((state) => ({
      pendingVisits: state.pendingVisits.map((v) => (v._id === visitId ? { ...v, status } : v)),
      todayVisits: state.todayVisits.map((v) => (v._id === visitId ? { ...v, status } : v)),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));

/**
 * Global State Management using Zustand
 * Owner-specific state for Horizon app
 */
import { create } from "zustand";

interface User {
  _id: string;
  name: string;
  phone: string;
  role: string;
  flat_id?: string;
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

interface RegularVisitor {
  _id: string;
  name: string;
  phone: string;
  photo_id: string;
  photo_url: string;
  qr_token: string;
  default_purpose: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

interface TempQR {
  _id: string;
  token: string;
  owner_id: string;
  guest_name?: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
  is_active: boolean;
}

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Visits
  pendingVisits: Visit[];
  pendingCount: number;
  todayCount: number;
  recentActivity: Visit[];

  // Regular Visitors
  regularVisitors: RegularVisitor[];
  regularCount: number;

  // Temporary QR
  tempQRs: TempQR[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;

  // Visit actions
  setPendingVisits: (visits: Visit[]) => void;
  setPendingCount: (count: number) => void;
  setTodayCount: (count: number) => void;
  setRecentActivity: (visits: Visit[]) => void;
  addPendingVisit: (visit: Visit) => void;
  removePendingVisit: (visitId: string) => void;
  updateVisitStatus: (visitId: string, status: Visit["status"]) => void;

  // Regular visitor actions
  setRegularVisitors: (visitors: RegularVisitor[]) => void;
  setRegularCount: (count: number) => void;
  addRegularVisitor: (visitor: RegularVisitor) => void;
  updateRegularVisitor: (visitorId: string, data: Partial<RegularVisitor>) => void;
  removeRegularVisitor: (visitorId: string) => void;

  // Temp QR actions
  setTempQRs: (qrs: TempQR[]) => void;
  addTempQR: (qr: TempQR) => void;
  removeTempQR: (qrId: string) => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  pendingVisits: [],
  pendingCount: 0,
  todayCount: 0,
  recentActivity: [],
  regularVisitors: [],
  regularCount: 0,
  tempQRs: [],
  isLoading: false,
  error: null,

  // Auth actions
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

  // Visit actions
  setPendingVisits: (visits) => set({ pendingVisits: visits }),

  setPendingCount: (count) => set({ pendingCount: count }),

  setTodayCount: (count) => set({ todayCount: count }),

  setRecentActivity: (visits) => set({ recentActivity: visits }),

  addPendingVisit: (visit) =>
    set((state) => ({
      pendingVisits: [visit, ...state.pendingVisits],
      pendingCount: state.pendingCount + 1,
    })),

  removePendingVisit: (visitId) =>
    set((state) => ({
      pendingVisits: state.pendingVisits.filter((v) => v._id !== visitId),
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),

  updateVisitStatus: (visitId, status) =>
    set((state) => ({
      pendingVisits: state.pendingVisits.map((v) => (v._id === visitId ? { ...v, status } : v)),
      recentActivity: state.recentActivity.map((v) => (v._id === visitId ? { ...v, status } : v)),
    })),

  // Regular visitor actions
  setRegularVisitors: (visitors) => set({ regularVisitors: visitors }),

  setRegularCount: (count) => set({ regularCount: count }),

  addRegularVisitor: (visitor) =>
    set((state) => ({
      regularVisitors: [visitor, ...state.regularVisitors],
      regularCount: state.regularCount + 1,
    })),

  updateRegularVisitor: (visitorId, data) =>
    set((state) => ({
      regularVisitors: state.regularVisitors.map((v) =>
        v._id === visitorId ? { ...v, ...data } : v
      ),
    })),

  removeRegularVisitor: (visitorId) =>
    set((state) => ({
      regularVisitors: state.regularVisitors.filter((v) => v._id !== visitorId),
      regularCount: Math.max(0, state.regularCount - 1),
    })),

  // Temp QR actions
  setTempQRs: (qrs) => set({ tempQRs: qrs }),

  addTempQR: (qr) =>
    set((state) => ({
      tempQRs: [qr, ...state.tempQRs],
    })),

  removeTempQR: (qrId) =>
    set((state) => ({
      tempQRs: state.tempQRs.filter((q) => q._id !== qrId),
    })),

  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));

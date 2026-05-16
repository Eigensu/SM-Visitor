/**
 * Global State Management using Zustand
 * Owner-specific state for Horizon app
 */
import { create } from "zustand";
import {
  normalizeNotification,
  normalizeNotificationList,
  normalizeRegularVisitorList,
  normalizeRegularVisitorRecord,
  normalizeVisitList,
  normalizeVisitRecord,
} from "@sm-visitor/hooks";

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  flat_id?: string;
  created_at: string;
}

interface Visit {
  id: string;
  _id?: string;
  visitor_id?: string | null;
  name_snapshot?: string;
  name?: string;
  phone_snapshot?: string | null;
  phone?: string | null;
  photo_snapshot_url?: string | null;
  photo?: string | null;
  purpose?: string;
  owner_id?: string;
  guard_id?: string;
  entry_time?: string;
  exit_time?: string;
  status: "pending" | "approved" | "rejected" | "auto_approved" | "deleted";
  approval_status?: "pending" | "approved" | "rejected" | "auto_approved" | "deleted";
  is_all_flats?: boolean;
  valid_flats?: string[];
  target_flat_ids?: string[];
  created_at: string;
}

interface RegularVisitor {
  id?: string;
  _id: string;
  visitor_id?: string | null;
  name?: string;
  phone?: string;
  photo_id?: string;
  photo_url?: string;
  qr_token?: string;
  default_purpose?: string;
  created_by?: string;
  approval_status?: "pending" | "approved" | "rejected" | "auto_approved" | "deleted";
  is_active?: boolean;
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

export interface AppNotification {
  id?: string;
  _id?: string;
  type: string;
  title: string;
  message: string;
  body?: string;
  text?: string;
  created_at?: string;
  is_read?: boolean;
}

const isBrowser = typeof window !== "undefined";

const setStorageItem = (key: string, value: string) => {
  if (!isBrowser) return;
  localStorage.setItem(key, value);
};

const removeStorageItem = (key: string) => {
  if (!isBrowser) return;
  localStorage.removeItem(key);
};

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

  // Notifications
  notifications: AppNotification[];
  unreadCount: number;

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

  // Notification actions
  setNotifications: (notifications: AppNotification[]) => void;
  addNotification: (notification: AppNotification) => void;
  setUnreadCount: (count: number) => void;
  clearUnreadCount: () => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Refresh Trigger (Scoped for performance)
  refreshMap: {
    visitors: number;
    approvals: number;
    dashboard: number;
  };
  triggerRefresh: (scope: "visitors" | "approvals" | "dashboard") => void;
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
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  refreshMap: {
    visitors: 0,
    approvals: 0,
    dashboard: 0,
  },
  triggerRefresh: (scope) =>
    set((state) => ({
      refreshMap: {
        ...state.refreshMap,
        [scope]: state.refreshMap[scope] + 1,
      },
    })),

  // Auth actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    if (token) {
      setStorageItem("auth_token", token);
    } else {
      removeStorageItem("auth_token");
    }
    set({ token });
  },

  login: (user, token) => {
    setStorageItem("auth_token", token);
    setStorageItem("user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    removeStorageItem("auth_token");
    removeStorageItem("user");
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      notifications: [],
      unreadCount: 0,
    });
  },

  // Visit actions
  setPendingVisits: (visits) => set({ pendingVisits: normalizeVisitList(visits) }),

  setPendingCount: (count) => set({ pendingCount: count }),

  setTodayCount: (count) => set({ todayCount: count }),

  setRecentActivity: (visits) => set({ recentActivity: normalizeVisitList(visits) }),

  addPendingVisit: (visit) =>
    set((state) => ({
      pendingVisits: [normalizeVisitRecord(visit), ...state.pendingVisits],
      pendingCount: state.pendingCount + 1,
    })),

  removePendingVisit: (visitId) =>
    set((state) => ({
      pendingVisits: state.pendingVisits.filter((v) => v.id !== visitId),
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),

  updateVisitStatus: (visitId, status) =>
    set((state) => {
      const updatedPending = state.pendingVisits.map((v) =>
        v.id === visitId ? { ...v, status, approval_status: status } : v
      );

      const updatedRecent = state.recentActivity.map((v) =>
        v.id === visitId ? { ...v, status, approval_status: status } : v
      );

      return {
        pendingVisits: updatedPending,
        recentActivity: updatedRecent,
      };
    }),

  // Regular visitor actions
  setRegularVisitors: (visitors) => set({ regularVisitors: normalizeRegularVisitorList(visitors) }),

  setRegularCount: (count) => set({ regularCount: count }),

  addRegularVisitor: (visitor) =>
    set((state) => ({
      regularVisitors: [normalizeRegularVisitorRecord(visitor), ...state.regularVisitors],
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

  // Notification actions
  setNotifications: (notifications) =>
    set({ notifications: normalizeNotificationList(notifications) }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [normalizeNotification(notification), ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  setUnreadCount: (count) => set({ unreadCount: count }),
  clearUnreadCount: () => set({ unreadCount: 0 }),

  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));

/**
 * Dashboard Page - Main Guard Interface
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { visitsAPI, visitorsAPI } from "@/lib/api";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { LogOut, QrCode, UserPlus, ClipboardList, Clock, CheckCircle2, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { GlassCard } from "@/components/GlassCard";
import { NotificationCenter } from "@/components/NotificationCenter";
import toast from "react-hot-toast";

interface Visit {
  id: string;
  entry_time?: string;
  exit_time?: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isAuthLoading, logout, pendingVisits, refreshMap } = useStore();
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [pendingStaffCount, setPendingStaffCount] = useState(0);

  // All hooks must be at the top level - no conditional hooks!
  useEffect(() => {
    // Wait for auth loading to complete before redirecting
    if (!isAuthLoading && !isAuthenticated) {
      console.log("Not authenticated, redirecting to login");
      router.push("/login");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // Fetch today's visits and staff directory for statistics
  const fetchStats = async (signal?: AbortSignal) => {
    try {
      const [visits, staff] = await Promise.all([
        visitsAPI.getTodayVisits(signal),
        visitorsAPI.list(signal),
      ]);
      setTodayVisits(visits);
      setPendingStaffCount(
        staff.filter((v: any) => v.visitor_type === "regular" && v.approval_status === "pending")
          .length
      );
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("canceled")) {
        return; // Silent fail for aborted requests
      }
      console.error("📡 [ORBIT] Failed to fetch dashboard statistics:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isAuthLoading) {
      const controller = new AbortController();
      fetchStats(controller.signal);

      // 🔥 HARDENED: Polling Fallback (10s) as per Spec
      const interval = setInterval(() => fetchStats(controller.signal), 10000);

      return () => {
        controller.abort();
        clearInterval(interval);
      };
    }
  }, [isAuthenticated, isAuthLoading, refreshMap.dashboard]);

  const totalPending = pendingVisits.length + pendingStaffCount;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Show loading spinner while auth is being restored
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const actionCards = [
    {
      title: "Staff Directory",
      description: "Maids, Cooks & Official Staff",
      icon: Users,
      href: "/staff",
    },
    {
      title: "Register Regular",
      description: "New staff registration",
      icon: UserPlus,
      href: "/new-regular-visitor",
    },
    {
      title: "Scan QR Code",
      description: "Quick entry scan",
      icon: QrCode,
      href: "/scan",
    },
    {
      title: "Today's Log",
      description: "View all activity",
      icon: ClipboardList,
      href: "/history",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Orbit Guard</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationCenter />
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Pending Approvals Badge */}
        {/* Pending Approvals Badge - Always visible but different style if empty */}
        <div
          onClick={() => {
            if (pendingStaffCount > 0 && pendingVisits.length === 0) {
              router.push("/staff?filter=pending");
            } else {
              router.push("/history?status=pending");
            }
          }}
          className={`mb-6 cursor-pointer rounded-lg border p-4 transition-colors ${
            totalPending > 0
              ? "border-yellow-200 bg-yellow-50 hover:bg-yellow-100"
              : "border-gray-200 bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className={`h-5 w-5 ${totalPending > 0 ? "text-yellow-400" : "text-gray-400"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p
                className={`text-sm font-medium ${totalPending > 0 ? "text-yellow-800" : "text-gray-600"}`}
              >
                {totalPending} request{totalPending !== 1 ? "s" : ""} waiting for approval
              </p>
              <p
                className={`text-xs mt-1 ${totalPending > 0 ? "text-yellow-600" : "text-gray-500"}`}
              >
                {pendingStaffCount > 0 ? `${pendingStaffCount} staff + ` : ""}
                {pendingVisits.length} guest{pendingVisits.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {actionCards.map((card) => (
            <GlassCard key={card.title} hover onClick={() => router.push(card.href)}>
              <div className="flex flex-col items-center p-5 text-center sm:flex-row sm:text-left sm:items-start min-h-[100px] h-full justify-center">
                <div className="ocean-gradient mb-3 sm:mb-0 sm:mr-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-md shadow-primary/20">
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="mb-1 text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            title="Pending Actions"
            value={isLoadingStats ? "..." : totalPending}
            icon={Clock}
            onClick={() => {
              if (pendingStaffCount > 0) router.push("/staff");
              else router.push("/history?status=pending");
            }}
          />
          <StatCard
            title="Today's Visits"
            value={isLoadingStats ? "..." : todayVisits.length}
            icon={CheckCircle2}
            onClick={() => router.push("/history")}
          />
          <StatCard
            title="Active Now"
            value={
              isLoadingStats
                ? "..."
                : todayVisits.filter((v) => v.entry_time && !v.exit_time).length
            }
            icon={Users}
            onClick={() => router.push("/history?status=active")} // Note: History page needs to handle 'active' status or we filter manually
          />
        </div>
      </main>
    </div>
  );
}

/**
 * Dashboard Page - Main Guard Interface
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { visitsAPI } from "@/lib/api";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { QrCode, UserPlus, ClipboardList, LogOut, Clock, CheckCircle2, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { GlassCard } from "@/components/GlassCard";
import toast from "react-hot-toast";

interface Visit {
  id: string;
  entry_time?: string;
  exit_time?: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isAuthLoading,
    logout,
    pendingVisits,
    todayVisits,
    setTodayVisits,
  } = useStore();
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // All hooks must be at the top level - no conditional hooks!
  useEffect(() => {
    // Wait for auth loading to complete before redirecting
    if (!isAuthLoading && !isAuthenticated) {
      console.log("Not authenticated, redirecting to login");
      router.push("/login");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // Fetch today's visits for statistics
  useEffect(() => {
    const fetchTodayVisits = async () => {
      try {
        const visits = await visitsAPI.getTodayVisits();
        setTodayVisits(visits);
      } catch (error: any) {
        console.error("Failed to fetch today's visits:", error);
        toast.error("Failed to load visit statistics");
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (isAuthenticated && !isAuthLoading) {
      fetchTodayVisits();
    }
  }, [isAuthenticated, isAuthLoading, setTodayVisits]);

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
      title: "Scan QR Code",
      description: "Scan guest or staff QR",
      icon: QrCode,
      href: "/scan",
    },
    {
      title: "New Guest",
      description: "One-time visitor entry",
      icon: UserPlus,
      href: "/new-visitor",
    },
    {
      title: "Daily Staff / Regulars",
      description: "Maid, Cook, Driver, etc.",
      icon: Users,
      href: "/regulars",
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
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Pending Approvals Badge */}
        {/* Pending Approvals Badge - Always visible but different style if empty */}
        <div
          onClick={() => router.push("/history?status=pending")}
          className={`mb-6 cursor-pointer rounded-lg border p-4 transition-colors ${
            pendingVisits.length > 0
              ? "border-yellow-200 bg-yellow-50 hover:bg-yellow-100"
              : "border-gray-200 bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className={`h-5 w-5 ${pendingVisits.length > 0 ? "text-yellow-400" : "text-gray-400"}`}
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
                className={`text-sm font-medium ${pendingVisits.length > 0 ? "text-yellow-800" : "text-gray-600"}`}
              >
                {pendingVisits.length} visitor{pendingVisits.length !== 1 ? "s" : ""} waiting for
                approval
              </p>
              <p
                className={`text-xs mt-1 ${pendingVisits.length > 0 ? "text-yellow-600" : "text-gray-500"}`}
              >
                Click to review and manage
              </p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {actionCards.map((card) => (
            <GlassCard key={card.title} hover onClick={() => router.push(card.href)}>
              <div className="p-8">
                <div className="ocean-gradient mb-4 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-primary/20">
                  <card.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{card.title}</h3>
                <p className="text-muted-foreground">{card.description}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Unified History Link */}
        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full h-12 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/history")}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            View Complete Today's Log
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Pending Approvals"
            value={
              isLoadingStats ? "..." : todayVisits.filter((v) => v.status === "pending").length
            }
            icon={Clock}
            onClick={() => router.push("/history?status=pending")}
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
            onClick={() => router.push("/history?status=active")}
          />
          <StatCard
            title="Total Guests"
            value={isLoadingStats ? "..." : todayVisits.filter((v) => !v.visitor_id).length}
            icon={UserPlus}
            onClick={() => router.push("/history")}
          />
          <StatCard
            title="Total Daily Staff"
            value={isLoadingStats ? "..." : todayVisits.filter((v) => v.visitor_id).length}
            icon={Users}
            onClick={() => router.push("/history")}
          />
        </div>
      </main>
    </div>
  );
}

/**
 * Dashboard Page - Main Guard Interface
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { QrCode, UserPlus, ClipboardList, LogOut, Clock, CheckCircle2, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { GlassCard } from "@/components/GlassCard";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, pendingVisits } = useStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

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
      description: "Scan visitor QR for quick entry",
      icon: QrCode,
      href: "/scan",
    },
    {
      title: "New Visitor",
      description: "Register a new visitor",
      icon: UserPlus,
      href: "/new-visitor",
    },
    {
      title: "Today's Log",
      description: "View all visits today",
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
        {pendingVisits.length > 0 && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">
                  {pendingVisits.length} visitor{pendingVisits.length !== 1 ? "s" : ""} waiting for
                  approval
                </p>
              </div>
            </div>
          </div>
        )}

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

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Pending Approvals" value={pendingVisits.length} icon={Clock} />
          <StatCard title="Today's Visits" value={0} icon={CheckCircle2} />
          <StatCard title="Active Now" value={0} icon={Users} />
        </div>
      </main>
    </div>
  );
}

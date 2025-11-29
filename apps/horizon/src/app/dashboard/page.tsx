/**
 * Dashboard Page - Main owner dashboard
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { visitsAPI, visitorsAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTime } from "@/lib/utils";
import toast from "react-hot-toast";
import { LogOut, Bell, QrCode, Users } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, pendingCount, todayCount, regularCount, recentActivity } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Load dashboard data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [pending, today, regular, recent] = await Promise.all([
        visitsAPI.getPendingCount(),
        visitsAPI.getTodayCount(),
        visitorsAPI.getRegularCount(),
        visitsAPI.getRecentActivity(10),
      ]);

      useStore.setState({
        pendingCount: pending,
        todayCount: today,
        regularCount: regular,
        recentActivity: recent,
      });
    } catch (error: any) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="border-b border-purple-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Welcome, {user?.name || "Owner"}</h1>
              {user?.flat_id && <p className="text-sm text-gray-600">Flat {user.flat_id}</p>}
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/notifications")}>
                <Bell className="h-5 w-5" />
              </Button>
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
        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card
            className="cursor-pointer bg-white transition-shadow hover:shadow-lg"
            onClick={() => router.push("/approvals")}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                  <p className="mt-2 text-3xl font-bold text-purple-600">{pendingCount}</p>
                </div>
                <div className="rounded-full bg-purple-100 p-3">
                  <Bell className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              {pendingCount > 0 && (
                <p className="mt-4 text-sm text-purple-600">Click to review →</p>
              )}
            </div>
          </Card>

          <Card className="bg-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Visitors</p>
                  <p className="mt-2 text-3xl font-bold text-indigo-600">{todayCount}</p>
                </div>
                <div className="rounded-full bg-indigo-100 p-3">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-white">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Regular Visitors</p>
                  <p className="mt-2 text-3xl font-bold text-green-600">{regularCount}</p>
                </div>
                <div className="rounded-full bg-green-100 p-3">
                  <QrCode className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              className="cursor-pointer bg-white transition-shadow hover:shadow-lg"
              onClick={() => router.push("/temp-qr")}
            >
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-purple-100 p-3">
                    <QrCode className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Generate Guest QR</h3>
                    <p className="text-sm text-gray-600">Create temporary QR code for guests</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              className="cursor-pointer bg-white transition-shadow hover:shadow-lg"
              onClick={() => router.push("/visitors")}
            >
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-indigo-100 p-3">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Manage Regular Visitors</h3>
                    <p className="text-sm text-gray-600">Add, edit, or view regular visitors</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <Card className="bg-white p-8 text-center">
              <p className="text-gray-600">No recent activity</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((visit) => (
                <Card key={visit._id} className="bg-white">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <img
                          src={visit.photo_snapshot_url}
                          alt={visit.name_snapshot}
                          className="h-12 w-12 rounded-full border-2 border-gray-200 object-cover"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{visit.name_snapshot}</p>
                          <p className="text-sm text-gray-600">{visit.purpose}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-sm text-gray-500">
                          {visit.entry_time ? formatTime(visit.entry_time) : "Pending"}
                        </p>
                        <StatusBadge status={visit.status} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

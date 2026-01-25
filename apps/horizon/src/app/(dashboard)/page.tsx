"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/shared/StatCard";
import { VisitorCard } from "@/components/shared/VisitorCard";
import { GlassCard } from "@/components/shared/GlassCard";
import { Users, CheckCircle2, Clock, QrCode, TrendingUp, Calendar } from "lucide-react";
import { Button, Spinner } from "@sm-visitor/ui";
import { useStore } from "@/lib/store";
import { visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";

export default function Dashboard() {
  const router = useRouter();
  const { user } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  // State for real data
  const [stats, setStats] = useState({
    todayCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    activeQrCount: 0,
  });
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch all dashboard data in parallel
        const [dashboardStats, recent, weekly] = await Promise.all([
          visitsAPI.getDashboardStats(),
          visitsAPI.getRecentActivity(5),
          visitsAPI.getWeeklyStats(),
        ]);

        setStats(dashboardStats);
        setRecentVisitors(recent);
        setWeeklyStats(weekly.weekly_stats || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Calculate max value for chart scaling
  const maxWeeklyCount = Math.max(...weeklyStats.map((d) => d.count), 10);

  const statCards = [
    {
      title: "Today's Visitors",
      value: stats.todayCount,
      icon: Users,
      description: "Total visits today",
    },
    {
      title: "Pending Approvals",
      value: stats.pendingCount,
      icon: Clock,
      description: "Waiting for action",
    },
    {
      title: "Approved Today",
      value: stats.approvedCount,
      icon: CheckCircle2,
      description: "Auto or manual approved",
    },
    {
      title: "Active QR Codes",
      value: stats.activeQrCount,
      icon: QrCode,
      description: "Valid temporary QRs",
    },
  ];

  return (
    <PageContainer
      title={`Welcome back, ${user?.name || "Resident"}`}
      description="Here's what's happening at your residence today"
    >
      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div key={stat.title} className={`animate-fade-up delay-${(index + 1) * 100}`}>
            <StatCard {...stat} isLoading={isLoading} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Visitors */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Visitors</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/visitors")}
              className="text-primary hover:text-primary/80"
            >
              View all →
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : recentVisitors.length > 0 ? (
              recentVisitors.map((visitor) => (
                <VisitorCard
                  key={visitor.id || visitor._id}
                  visitor={{
                    id: visitor.id || visitor._id,
                    name: visitor.name_snapshot,
                    phone: visitor.phone_snapshot || "N/A",
                    purpose: visitor.purpose,
                    // flatNumber omitted as it's redundant for the owner
                    status: visitor.status,
                    timestamp: new Date(
                      visitor.created_at.endsWith("Z")
                        ? visitor.created_at
                        : visitor.created_at + "Z"
                    ).toLocaleDateString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    }),
                    photo: visitor.photo_snapshot_url,
                  }}
                  showActions={true}
                  onApprove={async () => {
                    try {
                      await visitsAPI.approve(visitor.id || visitor._id);
                      toast.success("Visit approved");
                      // Refresh data
                      const [dashboardStats, recent, weekly] = await Promise.all([
                        visitsAPI.getDashboardStats(),
                        visitsAPI.getRecentActivity(5),
                        visitsAPI.getWeeklyStats(),
                      ]);
                      setStats(dashboardStats);
                      setRecentVisitors(recent);
                      setWeeklyStats(weekly.weekly_stats || []);
                    } catch (error) {
                      console.error("Failed to approve:", error);
                      toast.error("Failed to approve visit");
                    }
                  }}
                  onReject={async () => {
                    if (!confirm("Reject this visitor?")) return;
                    try {
                      await visitsAPI.reject(visitor.id || visitor._id);
                      toast.success("Visit rejected");
                      // Refresh data
                      const [dashboardStats, recent, weekly] = await Promise.all([
                        visitsAPI.getDashboardStats(),
                        visitsAPI.getRecentActivity(5),
                        visitsAPI.getWeeklyStats(),
                      ]);
                      setStats(dashboardStats);
                      setRecentVisitors(recent);
                      setWeeklyStats(weekly.weekly_stats || []);
                    } catch (error) {
                      console.error("Failed to reject:", error);
                      toast.error("Failed to reject visit");
                    }
                  }}
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No recent visitors
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <GlassCard className="space-y-4">
            <h3 className="font-semibold text-foreground">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="flex h-auto flex-col gap-2 py-4 hover:border-primary/30"
                onClick={() => router.push("/qr-generator")}
              >
                <QrCode className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="text-xs">Generate QR</span>
              </Button>
              <Button
                variant="outline"
                className="flex h-auto flex-col gap-2 py-4 hover:border-primary/30"
                onClick={() => router.push("/approvals")}
              >
                <Clock className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="text-xs">Approvals</span>
              </Button>
              <Button
                variant="outline"
                className="flex h-auto flex-col gap-2 py-4 hover:border-primary/30"
                onClick={() => router.push("/visitors")}
              >
                <Users className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="text-xs">Visitors</span>
              </Button>
              <Button
                variant="outline"
                className="flex h-auto flex-col gap-2 py-4 hover:border-primary/30"
              >
                <Calendar className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="text-xs">Schedule</span>
              </Button>
            </div>
          </GlassCard>

          {/* Weekly Activity */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">This Week</h3>
              <TrendingUp className="h-4 w-4 text-success" strokeWidth={1.5} />
            </div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Spinner />
                </div>
              ) : weeklyStats.length > 0 ? (
                weeklyStats.map((item) => (
                  <div key={item.day} className="flex items-center gap-3">
                    <span className="w-8 text-xs text-muted-foreground">{item.day}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="ocean-gradient h-full rounded-full transition-all duration-500"
                        style={{ width: `${(item.count / maxWeeklyCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-muted-foreground">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground">No activity data</div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </PageContainer>
  );
}

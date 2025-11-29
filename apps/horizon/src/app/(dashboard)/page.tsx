"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/shared/StatCard";
import { VisitorCard } from "@/components/shared/VisitorCard";
import { GlassCard } from "@/components/shared/GlassCard";
import { Users, CheckCircle2, Clock, QrCode, TrendingUp, Calendar } from "lucide-react";
import { Button } from "@sm-visitor/ui";
import { useRouter } from "next/navigation";

const stats = [
  { title: "Today's Visitors", value: 12, icon: Users, trend: { value: 15, positive: true } },
  { title: "Pending Approvals", value: 3, icon: Clock, trend: { value: 8, positive: false } },
  { title: "Approved Today", value: 9, icon: CheckCircle2 },
  { title: "Active QR Codes", value: 5, icon: QrCode },
];

const recentVisitors = [
  {
    id: "1",
    name: "Rahul Sharma",
    phone: "+91 98765 43210",
    purpose: "Delivery - Amazon",
    flatNumber: "A-401",
    status: "pending" as const,
    timestamp: "2 min ago",
  },
  {
    id: "2",
    name: "Priya Patel",
    phone: "+91 87654 32109",
    purpose: "Guest Visit",
    flatNumber: "A-401",
    status: "approved" as const,
    timestamp: "15 min ago",
  },
  {
    id: "3",
    name: "Amit Kumar",
    phone: "+91 76543 21098",
    purpose: "Plumber",
    flatNumber: "A-401",
    status: "approved" as const,
    timestamp: "1 hour ago",
  },
];

export default function Dashboard() {
  const router = useRouter();

  return (
    <PageContainer
      title="Welcome back, Arjun"
      description="Here's what's happening at your residence today"
    >
      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div key={stat.title} className={`animate-fade-up delay-${(index + 1) * 100}`}>
            <StatCard {...stat} />
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
            {recentVisitors.map((visitor) => (
              <VisitorCard key={visitor.id} visitor={visitor} />
            ))}
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
              {[
                { day: "Mon", count: 8 },
                { day: "Tue", count: 12 },
                { day: "Wed", count: 6 },
                { day: "Thu", count: 15 },
                { day: "Fri", count: 10 },
                { day: "Sat", count: 4 },
                { day: "Sun", count: 2 },
              ].map((item) => (
                <div key={item.day} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-muted-foreground">{item.day}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="ocean-gradient h-full rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / 15) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-muted-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </PageContainer>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { Plus, User, QrCode, Trash2, Calendar, Clock, Shield } from "lucide-react";
import { visitorsAPI } from "@/lib/api";
import toast from "react-hot-toast";

const CATEGORY_ICONS: Record<string, string> = {
  maid: "🧹",
  cook: "👨‍🍳",
  driver: "🚗",
  delivery: "📦",
  milkman: "🥛",
  car_wash: "🧼",
  dog_walker: "🐕",
  cleaner: "✨",
  other: "📋",
};

const CATEGORY_LABELS: Record<string, string> = {
  maid: "Maid",
  cook: "Cook",
  driver: "Driver",
  delivery: "Delivery",
  milkman: "Milkman",
  car_wash: "Car Wash",
  dog_walker: "Dog Walker",
  cleaner: "Cleaner",
  other: "Other",
};

const APPROVAL_LABELS: Record<string, string> = {
  always: "Auto-approve",
  within_schedule: "Schedule-based",
  manual: "Manual approval",
  notify_only: "Notify only",
};

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export default function RegularVisitorsPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const fetchVisitors = async () => {
    try {
      setIsLoading(true);
      const data = await visitorsAPI.getRegularVisitors();
      setVisitors(data);
    } catch (error) {
      console.error("Failed to fetch visitors:", error);
      toast.error("Failed to load regular visitors");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleDelete = async (visitorId: string) => {
    if (!confirm("Are you sure you want to delete this visitor?")) return;

    try {
      await visitorsAPI.deleteRegularVisitor(visitorId);
      toast.success("Visitor deleted successfully");
      fetchVisitors();
    } catch (error) {
      console.error("Failed to delete visitor:", error);
      toast.error("Failed to delete visitor");
    }
  };

  const formatSchedule = (visitor: any) => {
    const schedule = visitor.schedule;
    if (!schedule?.enabled) return "No schedule";

    const days = schedule.days_of_week?.map((d: number) => DAY_LABELS[d]).join(", ") || "All days";
    const timeWindow = schedule.time_windows?.[0];
    if (timeWindow) {
      return `${days}, ${timeWindow.start_time}-${timeWindow.end_time}`;
    }
    return days;
  };

  const filteredVisitors =
    selectedCategory === "all" ? visitors : visitors.filter((v) => v.category === selectedCategory);

  return (
    <PageContainer
      title="Regular Visitors"
      description="Manage your regular visitors with QR codes"
      action={
        <Button
          className="ocean-gradient hover:opacity-90"
          onClick={() => router.push("/visitors/new")}
        >
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Add Visitor
        </Button>
      }
    >
      {/* Category Filters */}
      <GlassCard className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? "primary" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(key)}
            >
              {CATEGORY_ICONS[key]} {label}
            </Button>
          ))}
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredVisitors.length === 0 ? (
        <GlassCard className="py-12 text-center">
          <p className="text-muted-foreground">
            {selectedCategory === "all"
              ? "No regular visitors yet. Add one to get started!"
              : `No ${CATEGORY_LABELS[selectedCategory]} visitors found.`}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVisitors.map((visitor) => (
            <GlassCard key={visitor._id} className="p-6">
              {/* Header with Photo */}
              <div className="mb-4 flex items-start gap-4">
                {visitor.photo_url ? (
                  <img
                    src={`/api/uploads/regular-visitor-photo/${visitor.photo_url}`}
                    alt={visitor.name}
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-2 ring-primary/20">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{visitor.name}</h3>
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      PERMANENT QR
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{visitor.phone || "No phone"}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <div
                    className={`h-2 w-2 rounded-full ${visitor.auto_approval?.rule === "manual" ? "bg-yellow-400" : "bg-green-400"}`}
                  />
                  {APPROVAL_LABELS[visitor.auto_approval?.rule || "always"]}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  {visitor.schedule_enabled ? "📅 Scheduled" : "🔓 24/7 Access"}
                </div>
              </div>

              {/* Category Badge */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">{CATEGORY_ICONS[visitor.category || "other"]}</span>
                <span className="text-sm font-medium text-foreground">
                  {visitor.category_label || "Other"}
                </span>
              </div>

              {/* Schedule Info */}
              <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
                <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{formatSchedule(visitor)}</span>
              </div>

              {/* Auto-approval Rule */}
              <div className="mb-1.5 flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{visitor.auto_approval?.rule_label || "Always auto-approve"}</span>
              </div>

              {/* Targeting Info */}
              <div className="mb-4 flex items-start gap-2 text-sm">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span className="font-medium text-primary">
                  {visitor.is_all_flats
                    ? "Valid for All Flats"
                    : `Valid for: ${visitor.valid_flats?.join(", ") || "Selected Flat"}`}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    // TODO: Show QR code modal
                    toast.success("QR code display coming soon");
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleDelete(visitor._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

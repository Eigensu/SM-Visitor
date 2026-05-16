"use client";

import { UserPlus, CheckCircle, XCircle, LogOut, Clock } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { formatDateTime, parseDateTime } from "@/lib/utils";

interface TimelineEvent {
  type: "created" | "approved" | "rejected" | "exited";
  timestamp: string;
  label: string;
  details: string;
  icon: any;
  color: string;
}

export interface VisitorTimelineVisit {
  id: string;
  name_snapshot?: string;
  name?: string;
  phone_snapshot?: string | null;
  phone?: string | null;
  photo_snapshot_url?: string | null;
  photo?: string | null;
  purpose: string;
  status: "pending" | "approved" | "rejected" | "auto_approved" | "deleted";
  created_at: string;
  entry_time?: string | null;
  exit_time?: string | null;
  updated_at?: string | null;
  guard_name?: string | null;
  qr_token?: string | null;
}

interface VisitorTimelineProps {
  visit: VisitorTimelineVisit;
}

export function VisitorTimeline({ visit }: VisitorTimelineProps) {
  const calculateDuration = (start?: string | null, end?: string | null): string => {
    if (!start || !end) return "N/A";

    const startDate = parseDateTime(start);
    const endDate = parseDateTime(end);
    if (!startDate || !endDate) return "N/A";

    const diffMs = endDate.getTime() - startDate.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return formatDateTime(timestamp, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // 1. Created Event (always)
    events.push({
      type: "created",
      timestamp: visit.created_at,
      label: "Visit Requested",
      details: `By: ${visit.guard_name || "Unknown Guard"}`,
      icon: UserPlus,
      color: "text-blue-500",
    });

    // 2. Approval/Rejection Event
    if (visit.status === "approved" || visit.status === "auto_approved") {
      const approvalMethod = visit.qr_token ? "QR Code" : "Manual Approval";
      events.push({
        type: "approved",
        timestamp: visit.entry_time || visit.updated_at || visit.created_at,
        label: `Approved (${approvalMethod})`,
        details: "Entry granted",
        icon: CheckCircle,
        color: "text-green-500",
      });
    } else if (visit.status === "rejected") {
      events.push({
        type: "rejected",
        timestamp: visit.updated_at || visit.created_at,
        label: "Rejected",
        details: "Entry denied",
        icon: XCircle,
        color: "text-red-500",
      });
    } else if (visit.status === "pending") {
      events.push({
        type: "created",
        timestamp: visit.created_at,
        label: "Awaiting Approval",
        details: "Pending owner decision",
        icon: Clock,
        color: "text-yellow-500",
      });
    }

    // 3. Exit Event (if exists)
    if (visit.exit_time) {
      const duration = calculateDuration(visit.entry_time, visit.exit_time);
      events.push({
        type: "exited",
        timestamp: visit.exit_time,
        label: "Exited",
        details: `Duration: ${duration}`,
        icon: LogOut,
        color: "text-gray-500",
      });
    }

    return events;
  };

  const events = getTimelineEvents();

  return (
    <GlassCard className="p-6">
      {/* Header with Photo */}
      <div className="mb-6 flex items-start gap-4">
        {visit.photo || visit.photo_snapshot_url ? (
          <img
            src={visit.photo || visit.photo_snapshot_url || undefined}
            alt={visit.name || visit.name_snapshot || "Visitor"}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-2 ring-primary/20">
            <UserPlus className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {visit.name || visit.name_snapshot || "Unknown Visitor"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {visit.phone || visit.phone_snapshot || "No phone"} • {visit.purpose}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground">Timeline</h4>
        <div className="relative space-y-6 pl-6">
          {/* Vertical line */}
          <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />

          {events.map((event, index) => {
            const Icon = event.icon;
            return (
              <div key={index} className="relative">
                {/* Icon */}
                <div
                  className={`absolute -left-6 flex h-4 w-4 items-center justify-center rounded-full bg-background ${event.color}`}
                >
                  <Icon className="h-3 w-3" strokeWidth={2.5} />
                </div>

                {/* Content */}
                <div>
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.details}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

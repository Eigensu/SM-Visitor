"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { NotificationItem } from "@/components/shared/NotificationItem";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@sm-visitor/ui";
import { CheckCheck } from "lucide-react";

const notifications = [
  {
    id: "1",
    type: "approval" as const,
    title: "Visitor Approved",
    message: "Rahul Sharma has been approved for entry at the main gate.",
    timestamp: "2 min ago",
    read: false,
  },
  {
    id: "2",
    type: "security" as const,
    title: "Security Alert",
    message: "Main gate maintenance scheduled for tomorrow 10 AM - 12 PM.",
    timestamp: "1 hour ago",
    read: false,
  },
  {
    id: "3",
    type: "qr" as const,
    title: "QR Code Used",
    message: "Your temporary QR code was used for entry by Delivery Agent.",
    timestamp: "3 hours ago",
    read: true,
  },
  {
    id: "4",
    type: "rejection" as const,
    title: "Visitor Rejected",
    message: "Entry denied for Unknown Caller at the main gate.",
    timestamp: "Yesterday",
    read: true,
  },
  {
    id: "5",
    type: "general" as const,
    title: "Community Meeting",
    message: "Annual general meeting scheduled for this Sunday at the clubhouse.",
    timestamp: "2 days ago",
    read: true,
  },
];

export default function Notifications() {
  return (
    <PageContainer
      title="Notifications"
      description="Stay updated with latest activities"
      action={
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <CheckCheck className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Mark all as read
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {notifications.length > 0 ? (
          notifications.map((notification, index) => (
            <div key={notification.id} className={`animate-fade-up delay-${index * 100}`}>
              <GlassCard className="overflow-hidden p-0 transition-colors hover:bg-muted/30">
                <NotificationItem notification={notification} />
              </GlassCard>
            </div>
          ))
        ) : (
          <GlassCard className="py-12 text-center">
            <p className="text-muted-foreground">No notifications yet</p>
          </GlassCard>
        )}
      </div>
    </PageContainer>
  );
}

"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { NotificationItem } from "@/components/shared/NotificationItem";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button, Spinner } from "@sm-visitor/ui";
import { CheckCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await visitsAPI.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

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
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : notifications.length > 0 ? (
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

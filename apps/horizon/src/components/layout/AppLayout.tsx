"use client";

import { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { Menu, X } from "lucide-react";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@/components/shared/Spinner";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "../NotificationCenter";
import { visitsAPI, notificationsAPI } from "@/lib/api";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const user = useStore((state: any) => state.user);
  const isAuthenticated = useStore((state: any) => state.isAuthenticated);
  const setPendingCount = useStore((state: any) => state.setPendingCount);
  const setUnreadCount = useStore((state: any) => state.setUnreadCount);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication on mount
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    if (!token && !isAuthenticated) {
      router.push("/login");
    } else if (isAuthenticated) {
      setIsChecking(false);
    } else if (token) {
      const timer = setTimeout(() => {
        if (!useStore.getState().isAuthenticated) {
          router.push("/login");
        } else {
          setIsChecking(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  // Periodic data synchronization (Sync counts for sidebar badges)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const syncData = async () => {
      try {
        const stats = await visitsAPI.getDashboardStats();
        const unreadData = await notificationsAPI.getUnreadCount();

        setPendingCount(stats.pendingCount);
        setUnreadCount(typeof unreadData === "object" ? unreadData.count : unreadData);
      } catch (error) {
        console.error("Layout sync failed:", error);
      }
    };

    syncData();
    const interval = setInterval(syncData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [isAuthenticated, user, setPendingCount, setUnreadCount]);

  // Show loading spinner while checking auth
  if (isChecking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full transition-transform duration-300 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AppSidebar />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-[-48px] top-4 bg-card shadow-md"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-background/90 p-4 backdrop-blur-xl md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="-ml-2"
          >
            <Menu className="h-5 w-5 text-slate-500" />
          </Button>
          <h1 className="font-bold tracking-tight text-foreground">Horizon</h1>
          <div className="flex items-center">
            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </div>
  );
}

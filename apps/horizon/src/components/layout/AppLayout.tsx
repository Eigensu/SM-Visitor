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

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication on mount
    const token = localStorage.getItem("auth_token");

    // If we have a token in storage but not in store yet, wait (hydration happens in Providers)
    // If no token in storage, redirect immediately
    if (!token && !isAuthenticated) {
      router.push("/login");
    } else if (isAuthenticated) {
      setIsChecking(false);
    } else if (token) {
      // We have a token, wait for hydration
      // Set a timeout to avoid infinite loading if hydration fails
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
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 p-4 backdrop-blur-xl md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="-ml-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-foreground">Horizon</h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </div>
  );
}

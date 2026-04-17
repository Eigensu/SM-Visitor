import {
  LayoutDashboard,
  Users,
  CheckCircle2,
  QrCode,
  Bell,
  Settings,
  LogOut,
  Home,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SSEIndicator } from "@/components/shared/SSEIndicator";
import { NotificationCenter } from "../NotificationCenter";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: CheckCircle2, label: "Approvals", path: "/approvals" },
  { icon: Users, label: "Visitors", path: "/visitors" },
  { icon: UserCheck, label: "Regular Visitors", path: "/regular-visitors" },
  { icon: QrCode, label: "QR Generator", path: "/qr-generator" },
];

const bottomItems = [{ icon: Settings, label: "Settings", path: "/settings" }];

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AppSidebar({ collapsed = false, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pendingCount = useStore((state: any) => state.pendingCount);
  const unreadCount = useStore((state: any) => state.unreadCount);

  const logout = useStore((state: any) => state.logout);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-out",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="ocean-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
              <Home className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-semibold tracking-tight text-sidebar-foreground">
                  Horizon
                </h1>
                <p className="text-xs text-muted-foreground">Resident Portal</p>
              </div>
            )}
          </div>
          {!collapsed && <NotificationCenter />}
        </div>
      </div>

      {/* SSE Status */}
      <div className="px-4 py-3">
        <SSEIndicator connected={true} className={cn(collapsed && "justify-center px-2")} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const hasBadge =
            (item.label === "Approvals" && pendingCount > 0) ||
            (item.label === "Notifications" && unreadCount > 0);
          const badgeValue = item.label === "Approvals" ? pendingCount : unreadCount;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                strokeWidth={1.5}
              />

              {!collapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.label}</span>
                  {hasBadge && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-sidebar">
                      {badgeValue > 99 ? "99+" : badgeValue}
                    </span>
                  )}
                </div>
              )}

              {collapsed && hasBadge && (
                <div className="absolute right-1 top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        {bottomItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
            "text-destructive/70 hover:bg-destructive/10 hover:text-destructive",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

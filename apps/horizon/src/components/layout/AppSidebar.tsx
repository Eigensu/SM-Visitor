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
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SSEIndicator } from "@/components/shared/SSEIndicator";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: CheckCircle2, label: "Approvals", path: "/approvals" },
  { icon: Users, label: "Visitors", path: "/visitors" },
  { icon: UserCheck, label: "Regular Visitors", path: "/regular-visitors" },
  { icon: QrCode, label: "QR Generator", path: "/qr-generator" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
];

const bottomItems = [{ icon: Settings, label: "Settings", path: "/settings" }];

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AppSidebar({ collapsed = false, onToggle }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-out",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="border-b border-sidebar-border p-4">
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
      </div>

      {/* SSE Status */}
      <div className="px-4 py-3">
        <SSEIndicator connected={true} className={cn(collapsed && "justify-center px-2")} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
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

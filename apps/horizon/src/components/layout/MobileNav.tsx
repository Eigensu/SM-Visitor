import { LayoutDashboard, Users, CheckCircle2, QrCode, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: CheckCircle2, label: "Approvals", path: "/approvals" },
  { icon: QrCode, label: "QR", path: "/qr-generator" },
  { icon: Users, label: "Visitors", path: "/visitors" },
  { icon: Bell, label: "Alerts", path: "/notifications" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("h-5 w-5 transition-all duration-200", isActive && "scale-110")}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

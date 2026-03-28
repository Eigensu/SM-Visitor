"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@sm-visitor/ui";
import {
  Bell,
  Shield,
  Moon,
  Smartphone,
  LogOut,
  ChevronRight,
  User,
  Home,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  requestNotificationPermission,
  isNotificationSupported,
  getNotificationPermission,
} from "@/lib/notifications";

const settingsSections = [
  {
    title: "Notifications",
    icon: Bell,
    items: [
      { label: "Push Notifications", type: "toggle", defaultValue: true },
      { label: "Email Alerts", type: "toggle", defaultValue: false },
      { label: "SMS Alerts", type: "toggle", defaultValue: true },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    items: [
      { label: "Biometric Login", type: "toggle", defaultValue: true },
      { label: "Change Password", type: "link" },
      { label: "Two-Factor Auth", type: "toggle", defaultValue: false },
    ],
  },
  {
    title: "Appearance",
    icon: Moon,
    items: [
      { label: "Dark Mode", type: "toggle", defaultValue: false },
      { label: "Text Size", type: "link" },
    ],
  },
];

export default function Settings() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  useEffect(() => {
    setNotifPermission(isNotificationSupported() ? getNotificationPermission() : "unsupported");
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
    if (granted) {
      toast.success("Browser notifications enabled!");
    } else {
      toast.error("Notifications blocked. Please allow them in your browser settings.");
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const visits = await visitsAPI.exportAll();

      if (!visits || visits.length === 0) {
        toast.error("No activity data to export");
        return;
      }

      // Format rows for the sheet
      const rows = visits.map((v: any) => ({
        "Visitor Name": v.name_snapshot || "N/A",
        Phone: v.phone_snapshot || "N/A",
        Purpose: v.purpose || "N/A",
        "Flat / Owner": v.owner_id || "N/A",
        Status: v.status || "N/A",
        "Entry Time": v.entry_time ? new Date(v.entry_time).toLocaleString() : "N/A",
        "Exit Time": v.exit_time ? new Date(v.exit_time).toLocaleString() : "N/A",
        Date: new Date(v.created_at).toLocaleDateString(),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto-size columns
      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r: any) => String(r[key] || "").length)) + 2,
      }));
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Visit Activity");

      const filename = `visit-activity-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`Exported ${rows.length} records`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export activity");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageContainer title="Settings" description="Manage your preferences and account">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Profile Card */}
        <GlassCard className="flex items-center gap-4 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <User className="h-8 w-8 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Arjun Mehta</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Home className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Flat A-401, Sunrise Heights</span>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </GlassCard>

        {/* Settings Sections */}
        <div className="space-y-4">
          {settingsSections.map((section) => (
            <GlassCard key={section.title} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <section.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground">{section.title}</h3>
              </div>

              <div className="space-y-1">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="-mx-1 flex items-center justify-between rounded-lg px-1 py-3 transition-colors hover:bg-muted/30"
                  >
                    <Label className="cursor-pointer text-sm">{item.label}</Label>
                    {item.type === "toggle" ? (
                      <Switch defaultChecked={item.defaultValue} />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}

          {/* Device Info */}
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Smartphone className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-foreground">Device</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">App Version</span>
                <span className="text-foreground">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Sync</span>
                <span className="text-foreground">Just now</span>
              </div>
            </div>
          </GlassCard>

          {/* Browser Notifications */}
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Bell className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Browser Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  Get OS-level popups for visitor approvals and auto-entries
                </p>
              </div>
            </div>

            {notifPermission === "unsupported" && (
              <p className="text-sm text-muted-foreground">
                Your browser does not support notifications.
              </p>
            )}

            {notifPermission === "granted" && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                <span className="text-base">✅</span>
                Notifications are enabled
              </div>
            )}

            {notifPermission === "denied" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <span className="text-base">🚫</span>
                  Notifications are blocked in your browser
                </div>
                <p className="text-xs text-muted-foreground">
                  To enable, click the lock icon in your browser's address bar and allow
                  notifications.
                </p>
              </div>
            )}

            {notifPermission === "default" && (
              <Button
                className="ocean-gradient w-full hover:opacity-90"
                onClick={handleEnableNotifications}
              >
                <Bell className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Enable Notifications
              </Button>
            )}
          </GlassCard>

          {/* Export Activity */}
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Download className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Export Activity</h3>
                <p className="text-xs text-muted-foreground">
                  Download all your visit history as an Excel file
                </p>
              </div>
            </div>
            <Button
              className="ocean-gradient w-full hover:opacity-90"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {isExporting ? "Exporting..." : "Export as XLSX"}
            </Button>
          </GlassCard>

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => router.push("/login")}
          >
            <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Sign Out
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

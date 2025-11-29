"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@sm-visitor/ui";
import { Bell, Shield, Moon, Smartphone, LogOut, ChevronRight, User, Home } from "lucide-react";
import { useRouter } from "next/navigation";

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

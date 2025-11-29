import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { GlassCard } from "./GlassCard";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <GlassCard hover className={cn("group", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {trend && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.positive ? "text-success" : "text-destructive"
              )}
            >
              <span>{trend.positive ? "↑" : "↓"}</span>
              {Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
      </div>
    </GlassCard>
  );
}

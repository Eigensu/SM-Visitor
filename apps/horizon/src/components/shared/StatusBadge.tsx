import { cn } from "@/lib/utils";

export type StatusType = "approved" | "pending" | "rejected" | "expired" | "active";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  approved: {
    label: "Approved",
    className: "bg-success/10 text-success border-success/20",
  },
  pending: {
    label: "Pending",
    className: "bg-pending/10 text-pending border-pending/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
  },
  active: {
    label: "Active",
    className: "bg-primary/10 text-primary border-primary/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        config.className,
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "approved" && "bg-success",
          status === "pending" && "animate-pulse bg-pending",
          status === "rejected" && "bg-destructive",
          status === "expired" && "bg-muted-foreground",
          status === "active" && "bg-primary"
        )}
      />
      {config.label}
    </span>
  );
}

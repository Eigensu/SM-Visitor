import { cn } from "@/lib/utils";
import { User, Clock, MapPin, Phone } from "lucide-react";
import { StatusBadge, StatusType } from "./StatusBadge";
import { GlassCard } from "./GlassCard";
import { Button } from "@sm-visitor/ui";
import { motion } from "framer-motion";

interface VisitorCardProps {
  visitor: {
    id: string;
    name: string;
    phone: string;
    purpose: string;
    flatNumber?: string;
    status: StatusType;
    timestamp: string;
    photo?: string;
  };
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
  className?: string;
}

export function VisitorCard({
  visitor,
  onApprove,
  onReject,
  showActions = false,
  className,
}: VisitorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <GlassCard hover className={cn("space-y-4", className)}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
            {visitor.photo ? (
              <img src={visitor.photo} alt={visitor.name} className="h-full w-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-primary" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold text-foreground">{visitor.name}</h3>
              <StatusBadge status={visitor.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{visitor.purpose}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{visitor.phone}</span>
          </div>
          {visitor.flatNumber && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Flat {visitor.flatNumber}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{visitor.timestamp}</span>
          </div>
        </div>

        {showActions && visitor.status === "pending" && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              className="flex-1 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              className="ocean-gradient flex-1 hover:opacity-90"
            >
              Approve
            </Button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

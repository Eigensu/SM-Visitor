import { cn } from "@/lib/utils";
import { Bell, UserCheck, UserX, QrCode, Shield } from "lucide-react";
import { motion } from "framer-motion";

type NotificationType = "approval" | "rejection" | "qr" | "security" | "general";

interface NotificationItemProps {
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  };
  onClick?: () => void;
  className?: string;
}

const iconMap: Record<NotificationType, typeof Bell> = {
  approval: UserCheck,
  rejection: UserX,
  qr: QrCode,
  security: Shield,
  general: Bell,
};

const colorMap: Record<NotificationType, string> = {
  approval: "bg-success/10 text-success",
  rejection: "bg-destructive/10 text-destructive",
  qr: "bg-primary/10 text-primary",
  security: "bg-warning/10 text-warning",
  general: "bg-muted text-muted-foreground",
};

export function NotificationItem({ notification, onClick, className }: NotificationItemProps) {
  const Icon = iconMap[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      whileHover={{ x: 4 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-start gap-4 rounded-xl p-4 transition-colors",
        notification.read ? "bg-transparent hover:bg-muted/50" : "bg-primary/5 hover:bg-primary/10",
        className
      )}
    >
      <div className={cn("flex-shrink-0 rounded-xl p-2.5", colorMap[notification.type])}>
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn("truncate text-sm font-medium", !notification.read && "text-foreground")}
          >
            {notification.title}
          </h4>
          {!notification.read && (
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-2 text-xs text-muted-foreground/70">{notification.timestamp}</p>
      </div>
    </motion.div>
  );
}

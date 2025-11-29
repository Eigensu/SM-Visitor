import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

interface SSEIndicatorProps {
  connected: boolean;
  className?: string;
}

export function SSEIndicator({ connected, className }: SSEIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
        connected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        className
      )}
    >
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <Wifi className="h-3.5 w-3.5" />
          <span>Live</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}

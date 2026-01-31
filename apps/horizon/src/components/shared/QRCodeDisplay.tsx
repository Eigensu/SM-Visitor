import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import { Download, Share2, Clock } from "lucide-react";
import { Button } from "@sm-visitor/ui";

interface QRCodeDisplayProps {
  value: string;
  title?: string;
  subtitle?: string;
  expiresAt?: string;
  size?: number;
  className?: string;
  onDownload?: () => void;
  onShare?: () => void;
}

export function QRCodeDisplay({
  value,
  title,
  subtitle,
  expiresAt,
  size = 200,
  className,
  onDownload,
  onShare,
}: QRCodeDisplayProps) {
  return (
    <GlassCard className={cn("flex flex-col items-center text-center", className)}>
      {title && <h3 className="mb-1 text-lg font-semibold text-foreground">{title}</h3>}
      {subtitle && <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>}

      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-inner">
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="transparent"
          fgColor="currentColor"
          className="text-foreground"
          data-testid="qr-code"
        />
      </div>

      {expiresAt && (
        <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" strokeWidth={1.5} />
          <span>Expires: {expiresAt}</span>
        </div>
      )}

      <div className="mt-4 flex w-full gap-3">
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload} className="flex-1">
            <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Download
          </Button>
        )}
        {onShare && (
          <Button size="sm" onClick={onShare} className="ocean-gradient flex-1 hover:opacity-90">
            <Share2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Share
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, X } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { OrbitRecordDetails } from "@/lib/record-details";
import { Button } from "@sm-visitor/ui";

interface EntryPassCardProps {
  record: OrbitRecordDetails;
  className?: string;
  onDownload: () => void;
  onClose: () => void;
  isDownloading?: boolean;
}

export const EntryPassCard = forwardRef<HTMLDivElement, EntryPassCardProps>(function EntryPassCard(
  { record, className, onDownload, onClose, isDownloading },
  ref
) {
  return (
    <div className={className ? `w-full ${className}` : "w-full"}>
      <GlassCard className="w-full max-w-sm overflow-hidden border-border/70 bg-white p-0 shadow-2xl">
        <div ref={ref} className="bg-white">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Entry Pass
            </p>
            <h3 className="mt-2 text-2xl font-black leading-tight">{record.fullName}</h3>
            <p className="mt-1 text-sm text-white/70">{record.visitorTypeLabel}</p>
          </div>

          <div className="p-6">
            <div className="mb-6 flex items-center justify-center">
              <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl bg-white p-4 shadow-xl">
                <QRCodeSVG
                  value={record.qrToken || ""}
                  size={250}
                  level="H"
                  includeMargin
                  className="h-40 w-40"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Visitor / Staff
                </span>
                <span className="max-w-[65%] text-right text-sm font-semibold text-foreground">
                  {record.fullName}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Type
                </span>
                <span className="max-w-[65%] text-right text-sm font-semibold text-foreground">
                  {record.visitorTypeLabel}
                </span>
              </div>
              {record.flatOwner ? (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Flat / Owner
                  </span>
                  <span className="max-w-[65%] text-right text-sm font-semibold text-foreground">
                    {record.isAllFlats ? "Society" : record.flatOwner}
                  </span>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </span>
                <span className="max-w-[65%] text-right text-sm font-semibold text-foreground">
                  {record.status}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Validity
                </span>
                <span className="max-w-[65%] text-right text-sm font-semibold text-foreground">
                  {record.qrValidityHours || record.qrExpiresAt || "Permanent Entry Pass"}
                </span>
              </div>
            </div>

            <p className="mt-5 text-center text-sm text-muted-foreground">Printable Entry Pass</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-border/60 bg-background p-5 sm:grid-cols-2">
          <Button
            onClick={onDownload}
            className="w-full rounded-2xl font-semibold"
            disabled={isDownloading}
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download Entry Pass"}
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            className="w-full rounded-2xl font-semibold"
          >
            <X className="mr-2 h-4 w-4" />
            Close Pass
          </Button>
        </div>
      </GlassCard>
    </div>
  );
});

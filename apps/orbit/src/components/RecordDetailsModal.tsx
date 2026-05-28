"use client";

import { Button } from "@sm-visitor/ui";
import { GlassCard } from "@/components/GlassCard";
import { OrbitRecordDetails } from "@/lib/record-details";
import { formatTime } from "@/lib/utils";
import SecureImage from "@/components/ui/SecureImage";
import { User, X } from "lucide-react";

interface RecordDetailsModalProps {
  record: OrbitRecordDetails | null;
  open: boolean;
  onClose: () => void;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-white px-4 py-3 shadow-sm">
    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <span className="max-w-[58%] break-words text-right text-sm font-medium text-foreground">
      {value || "N/A"}
    </span>
  </div>
);

export function RecordDetailsModal({ record, open, onClose }: RecordDetailsModalProps) {
  if (!open || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <GlassCard className="w-full max-w-6xl overflow-hidden p-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Record Details
            </p>
            <h2 className="text-xl font-bold text-foreground">{record.fullName}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-10 w-10 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[calc(90vh-5rem)] overflow-y-auto px-5 py-5 sm:px-6 pr-4">
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-3xl border border-border/60 bg-white p-4 shadow-sm">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                {record.visitorPhoto ? (
                  <SecureImage
                    srcRaw={record.visitorPhoto}
                    alt={record.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-2xl font-semibold text-foreground">
                  {record.fullName}
                </h3>
                <p className="text-sm text-muted-foreground">{record.phone || "N/A"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {record.visitorTypeLabel.toUpperCase()}
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {record.status}
                  </span>
                  {record.categoryLabel && (
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {record.categoryLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border/70 p-4">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Basic Details
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Full Name
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Phone Number
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Visitor Type
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.visitorTypeLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Purpose
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.purpose || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Validity Period
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.qrValidityHours || record.qrExpiresAt || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Owner / Flat Assignment
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.isAllFlats ? "Society" : record.flatOwner || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Photos
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Visitor Photo
                    </p>
                    <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                      {record.visitorPhoto ? (
                        <SecureImage
                          srcRaw={record.visitorPhoto}
                          alt={record.fullName}
                          className="h-44 w-full bg-black/5 object-contain"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      ID Card Photo
                    </p>
                    <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                      {record.idCardPhoto ? (
                        <SecureImage
                          srcRaw={record.idCardPhoto}
                          alt={`${record.fullName} ID Card`}
                          className="h-44 w-full bg-black/5 object-contain"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Identity Information
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Card Type
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.idType || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Card Number
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.idNumber || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Visit Information
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Created Time
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.createdAt ? formatTime(record.createdAt) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Approved Time
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.approvedAt ? formatTime(record.approvedAt) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Entry Time
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.entryTime ? formatTime(record.entryTime) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Exit Time
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.exitTime ? formatTime(record.exitTime) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      QR Information
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {record.qrValidityHours || record.qrExpiresAt || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Guard Information
                    </p>
                    <p className="mt-1 text-sm text-foreground">{record.guardName || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

"use client";

import { QRCodeDisplay } from "@/components/shared/QRCodeDisplay";
import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@sm-visitor/ui";
import { Plus, History } from "lucide-react";
import { useState } from "react";

export default function QRGenerator() {
  const [activeQR, setActiveQR] = useState<string | null>("https://example.com/temp-visit/123");

  return (
    <PageContainer
      title="Temporary QR Code"
      description="Generate time-limited QR codes for visitors"
      action={
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" strokeWidth={1.5} />
          History
        </Button>
      }
    >
      <div className="mx-auto max-w-md space-y-6">
        {activeQR ? (
          <div className="animate-fade-up">
            <QRCodeDisplay
              value={activeQR}
              title="Entry Pass"
              subtitle="Valid for single entry"
              expiresAt="Today, 6:00 PM"
              onDownload={() => {}}
              onShare={() => {}}
            />
            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setActiveQR(null)}
              >
                Cancel Pass
              </Button>
            </div>
          </div>
        ) : (
          <GlassCard className="animate-fade-up py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Plus className="h-8 w-8 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Generate New Pass</h3>
            <p className="mx-auto mb-6 max-w-xs text-muted-foreground">
              Create a temporary QR code for delivery agents, guests, or service providers.
            </p>
            <Button
              className="ocean-gradient hover:opacity-90"
              onClick={() => setActiveQR("https://example.com/temp-visit/new")}
            >
              Generate QR Code
            </Button>
          </GlassCard>
        )}

        <div className="text-center text-xs text-muted-foreground">
          <p>QR codes are valid for one-time entry only.</p>
          <p className="mt-1">Visitors must show this code at the security gate.</p>
        </div>
      </div>
    </PageContainer>
  );
}

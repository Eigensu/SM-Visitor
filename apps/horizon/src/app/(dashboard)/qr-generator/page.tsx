"use client";

import { QRCodeDisplay } from "@/components/shared/QRCodeDisplay";
import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button, Input, Spinner } from "@sm-visitor/ui";
import { Plus, History, Clock, User } from "lucide-react";
import { useState, useEffect } from "react";
import { tempQRAPI } from "@/lib/api";
import toast from "react-hot-toast";

import { downloadQRCode, downloadQRFromSVG } from "@/lib/download-utils";

export default function QRGenerator() {
  const [activeQR, setActiveQR] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [guestName, setGuestName] = useState("");
  const [validityHours, setValidityHours] = useState(24);
  const [isAllFlats, setIsAllFlats] = useState(false);
  const [selectedFlats, setSelectedFlats] = useState<string[]>([]);
  const [availableFlats, setAvailableFlats] = useState<string[]>([]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const data = await tempQRAPI.getActive();
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch QR history:", error);
      toast.error("Failed to load active passes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const fetchFlats = async () => {
      try {
        const owners = (await tempQRAPI.getAvailableFlats?.()) || [];
        // fallback if API doesn't have it explicitly
        const flats = Array.from(
          new Set(owners.map((o: any) => o.flat_id).filter(Boolean))
        ) as string[];
        setAvailableFlats(flats.sort());
      } catch (error) {
        console.error("Failed to fetch flats:", error);
      }
    };
    fetchFlats();
  }, []);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const data = await tempQRAPI.generate({
        guest_name: guestName || undefined,
        validity_hours: validityHours,
        is_all_flats: isAllFlats,
        valid_flats: isAllFlats ? [] : selectedFlats,
      });

      setActiveQR(data);
      toast.success("QR Code generated successfully");
      fetchHistory(); // Refresh history

      // Reset form
      setGuestName("");
      setValidityHours(24);
    } catch (error) {
      console.error("Failed to generate QR:", error);
      toast.error("Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (qrData: any) => {
    console.log("Download QR Data:", qrData); // Debug log
    const filename = qrData.guest_name || "Guest";

    // Use the base64 image from the backend if available
    if (qrData.qr_image_url) {
      console.log("Using backend qr_image_url"); // Debug log
      downloadQRCode(
        qrData.qr_image_url,
        filename,
        () => toast.success("QR Code downloaded"),
        (error) => toast.error(error)
      );
      return;
    }

    // Fallback: Generate from QR component
    console.log("Fallback to SVG conversion"); // Debug log
    const qrElement = document.querySelector('[data-testid="qr-code"]') as SVGElement;
    if (!qrElement) {
      toast.error("QR code not found");
      return;
    }

    downloadQRFromSVG(
      qrElement,
      filename,
      () => toast.success("QR Code downloaded"),
      (error) => toast.error(error)
    );
  };

  const handleShare = async (qrData: any) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Visitor Entry Pass",
          text: `Entry pass for ${qrData.guest_name || "Guest"}. Valid until ${new Date(qrData.expires_at).toLocaleString()}`,
          url: window.location.href, // Ideally this would be a public link
        });
      } catch (error) {
        console.log("Error sharing:", error);
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(qrData.token);
      toast.success("Token copied to clipboard");
    }
  };

  return (
    <PageContainer
      title="Temporary QR Code"
      description="Generate time-limited QR codes for visitors"
    >
      <div className="mx-auto max-w-md space-y-8">
        {/* Generator Section */}
        {activeQR ? (
          <div className="animate-fade-up">
            <QRCodeDisplay
              value={activeQR.token}
              title={activeQR.guest_name || "Guest Entry Pass"}
              subtitle="Valid for single entry"
              expiresAt={new Date(activeQR.expires_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              onDownload={() => handleDownload(activeQR)}
              onShare={() => handleShare(activeQR)}
            />
            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setActiveQR(null)}
              >
                Generate Another
              </Button>
            </div>
          </div>
        ) : (
          <GlassCard className="animate-fade-up space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Plus className="h-8 w-8 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Generate New Pass</h3>
              <p className="text-sm text-muted-foreground">
                Create a one-time entry pass for guests
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Guest Name (Optional)"
                placeholder="e.g., Delivery Agent, Friend"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Validity</label>
                <div className="flex gap-2">
                  {[4, 12, 24, 48].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => setValidityHours(hours)}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                        validityHours === hours
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-muted/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Valid for All Flats</span>
                  <input
                    type="checkbox"
                    checked={isAllFlats}
                    onChange={(e) => setIsAllFlats(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>

                {!isAllFlats && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Specific Flats
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {availableFlats.map((flat) => (
                        <button
                          key={flat}
                          type="button"
                          onClick={() => {
                            setSelectedFlats((prev) =>
                              prev.includes(flat) ? prev.filter((f) => f !== flat) : [...prev, flat]
                            );
                          }}
                          className={`rounded border px-1 py-1 text-[10px] font-medium transition-all sm:text-xs ${
                            selectedFlats.includes(flat)
                              ? "border-primary bg-primary text-white shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {flat}
                        </button>
                      ))}
                    </div>
                    {selectedFlats.length === 0 && (
                      <p className="text-[10px] font-medium italic text-amber-600">
                        Defaults to your flat only
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                className="ocean-gradient w-full hover:opacity-90"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <span className="mr-2">
                    <Spinner size="sm" />
                  </span>
                ) : null}
                Generate QR Code
              </Button>
            </div>
          </GlassCard>
        )}

        {/* Active Passes History */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <History className="h-4 w-4" />
            Active Passes ({history.length})
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map((qr) => (
                <GlassCard key={qr.id} className="flex items-center justify-between p-4" hover>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <User className="h-5 w-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{qr.guest_name || "Guest"}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Expires{" "}
                          {new Date(qr.expires_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveQR(qr)}>
                    View
                  </Button>
                </GlassCard>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No active passes found
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

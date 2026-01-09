/**
 * QR Scan Page
 * Allows guards to scan visitor QR codes for quick entry
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/QRScanner";
import { VisitorPreview } from "@/components/VisitorPreview";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

type ScanState = "scanning" | "preview" | "submitting";

export default function ScanPage() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [visitorData, setVisitorData] = useState<any>(null);
  const [qrToken, setQRToken] = useState<string | null>(null);

  const handleScanSuccess = async (decodedText: string) => {
    try {
      // Parse QR data (it's a JSON string)
      const qrData = JSON.parse(decodedText);
      const token = qrData.token;

      if (!token) {
        toast.error("Invalid QR code format");
        return;
      }

      // Validate QR with backend
      const response = await visitsAPI.scanQR(token);

      if (!response.valid) {
        toast.error(response.error || "Invalid or expired QR code");
        return;
      }

      // Show visitor preview
      setVisitorData(response.visitor_data);
      setQRToken(token);
      setScanState("preview");
    } catch (error: any) {
      console.error("QR scan error:", error);
      if (error.message?.includes("JSON")) {
        toast.error("Invalid QR code format");
      } else {
        toast.error(error.response?.data?.detail || "Failed to validate QR code");
      }
    }
  };

  const handleSubmitEntry = async () => {
    if (!qrToken || !visitorData) return;

    setScanState("submitting");

    try {
      await visitsAPI.startVisit({
        qr_token: qrToken,
        owner_id: visitorData.owner_id,
        purpose: visitorData.purpose || "Visit",
      });

      toast.success("Entry recorded successfully!");
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Submit entry error:", error);
      toast.error(error.response?.data?.detail || "Failed to record entry");
      setScanState("preview");
    }
  };

  const handleCancel = () => {
    setVisitorData(null);
    setQRToken(null);
    setScanState("scanning");
  };

  const handleBack = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-foreground">Scan QR Code</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {scanState === "scanning" && (
          <div className="space-y-6">
            <div className="rounded-lg bg-accent p-4">
              <p className="text-sm text-accent-foreground">
                <strong>Instructions:</strong> Position the QR code within the camera frame. The
                scan will happen automatically.
              </p>
            </div>

            <QRScanner onScanSuccess={handleScanSuccess} />
          </div>
        )}

        {scanState === "preview" && visitorData && (
          <div className="space-y-6">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">✓ QR code validated successfully</p>
            </div>

            <VisitorPreview
              visitor={visitorData}
              onSubmit={handleSubmitEntry}
              onCancel={handleCancel}
              isLoading={false}
            />
          </div>
        )}

        {scanState === "submitting" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" />
            <p className="mt-4 text-lg font-medium text-gray-700">Recording entry...</p>
          </div>
        )}
      </main>
    </div>
  );
}

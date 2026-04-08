/**
 * QR Scan Page
 * Allows guards to scan visitor QR codes for quick entry
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/QRScanner";
import { VisitorPreview } from "@/components/VisitorPreview";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

type ScanState = "scanning" | "preview" | "submitting" | "error";

export default function ScanPage() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [visitorData, setVisitorData] = useState<any>(null);
  const [qrToken, setQRToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleScanSuccess = async (decodedText: string) => {
    try {
      let token: string | null = null;
      let visitorInfo: any = null;

      try {
        // Try to parse as JSON first (new format)
        const qrData = JSON.parse(decodedText);
        token = qrData.token;
        visitorInfo = qrData; // Store other details if needed
      } catch (e) {
        // Fallback: Treat the whole text as the token (legacy format)
        console.log("Failed to parse QR JSON, using raw text as token");
        token = decodedText;
      }

      if (!token) {
        setErrorMessage("Invalid QR code format");
        setScanState("error");
        toast.error("Invalid QR code format");
        return;
      }

      // Prevent duplicate scans of the same QR token
      if (qrToken === token) {
        console.log("Duplicate QR token ignored");
        return;
      }

      // Validate QR with backend
      const response = await visitsAPI.scanQR(token);

      if (!response.valid) {
        // Handle specific error cases
        if (
          response.error?.includes("already used") ||
          response.error?.includes("already scanned")
        ) {
          setErrorMessage("This QR code has already been used");
        } else {
          setErrorMessage(response.error || "Invalid or expired QR code");
        }

        setScanState("error");
        toast.error(response.error || "Invalid or expired QR code");
        return;
      }

      // Show visitor preview
      // Use backend response data, or merge with QR data if useful
      setVisitorData(response.visitor_data);
      setQRToken(token);
      setScanState("preview");

      toast.success("QR code validated successfully!");
    } catch (error: any) {
      console.error("QR scan error:", error);
      const msg = error.response?.data?.detail || "Failed to validate QR code";
      setErrorMessage(msg);
      setScanState("error");
      toast.error(msg);
    }
  };

  const handleSubmitEntry = async () => {
    if (!qrToken || !visitorData) return;

    setScanState("submitting");

    try {
      const visit = await visitsAPI.startVisit({
        qr_token: qrToken,
        owner_id: visitorData.owner_id,
        purpose: visitorData.purpose || "Visit",
      });

      if (visit.status === "pending") {
        toast.success("Entry requested! Waiting for owner approval.");
      } else {
        toast.success("Entry recorded successfully!");
      }
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
    setErrorMessage(null);
    setScanState("scanning");
  };

  const handleTryAgain = () => {
    setErrorMessage(null);
    setQRToken(null);
    setScanState("scanning");
  };

  const handleViewTodaysVisits = () => {
    router.push("/dashboard");
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

            <QRScanner onScanSuccess={handleScanSuccess} isActive={scanState === "scanning"} />

            {/* Manual input fallback */}
            <div className="border-t border-border pt-6">
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Having trouble scanning? Try manual input
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="manual-qr"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Enter QR Code Data
                    </label>
                    <textarea
                      id="manual-qr"
                      placeholder='Paste QR code content here (e.g., {"token":"abc123"})'
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value) {
                          try {
                            // Validate JSON format
                            JSON.parse(value);
                            // If valid, process it
                            handleScanSuccess(value);
                          } catch {
                            // Invalid JSON, ignore for now
                          }
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If the QR code won't scan, you can manually copy and paste its content here.
                  </p>
                </div>
              </details>
            </div>
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

        {scanState === "error" && (
          <div className="space-y-6">
            <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-red-800">QR Code Already Used</h3>
              <p className="mt-2 text-sm text-red-700">
                {errorMessage || "This QR code has already been scanned and used for entry."}
              </p>
            </div>

            <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
              <Button
                onClick={handleViewTodaysVisits}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                View Today's Visits
              </Button>
              <Button onClick={handleTryAgain} variant="outline" className="flex-1">
                Scan New QR Code
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * QR Scanner Component
 * Wraps html5-qrcode library for QR code scanning
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

export function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initScanner = async () => {
      try {
        // Initialize scanner
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        // Start scanning
        await scanner.start(
          { facingMode: "environment" }, // Use back camera
          {
            fps: 10, // Frames per second
            qrbox: { width: 250, height: 250 }, // Scanning box size
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success callback
            console.log("QR Code detected:", decodedText);
            onScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Error callback (fires frequently, so we don't show all errors)
            // Only log actual errors, not "No QR code found" messages
            if (!errorMessage.includes("NotFoundException")) {
              console.warn("QR Scan error:", errorMessage);
            }
          }
        );

        setIsScanning(true);
        setError(null);
      } catch (err: any) {
        console.error("Failed to start scanner:", err);
        const errorMsg = err.message || "Failed to access camera";
        setError(errorMsg);
        onScanError?.(errorMsg);
      }
    };

    initScanner();

    // Cleanup on unmount
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            console.log("Scanner stopped");
          })
          .catch((err) => {
            console.error("Error stopping scanner:", err);
          });
      }
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-warning"
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
        <h3 className="mt-4 text-lg font-semibold text-foreground">Camera Access Required</h3>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-4 text-left text-sm text-muted-foreground">
          <p className="font-semibold">Please ensure:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>Camera permission is granted in your browser</li>
            <li>No other app is using the camera</li>
            <li>Your device has a working camera</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div id="qr-reader" className="overflow-hidden rounded-lg" />
      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground">
          {isScanning ? "Position QR code within the frame" : "Initializing camera..."}
        </p>
      </div>
    </div>
  );
}

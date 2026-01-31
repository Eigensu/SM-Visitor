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
  isActive?: boolean; // New prop to control scanner activity
  shouldReset?: boolean; // New prop to reset scanner state
}

export function QRScanner({
  onScanSuccess,
  onScanError,
  isActive = true,
  shouldReset = false,
}: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        console.log("Scanner stopped successfully");
        setIsScanning(false);
        scannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  // Reset scanner when shouldReset prop changes
  useEffect(() => {
    if (shouldReset) {
      console.log("Resetting scanner state");
      hasScannedRef.current = false;
      setScanComplete(false);
      setScanAttempts(0);
    }
  }, [shouldReset]);

  useEffect(() => {
    // Don't start scanner if not active or already scanned
    if (!isActive || hasScannedRef.current || scanComplete) {
      return;
    }

    const initScanner = async () => {
      try {
        // Initialize scanner
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        // Calculate responsive qrbox size
        const containerWidth = containerRef.current?.clientWidth || 300;
        const qrboxSize = Math.min(containerWidth * 0.8, 280);

        // Start scanning
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10, // Lower FPS to reduce processing
            qrbox: { width: qrboxSize, height: qrboxSize },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          (decodedText) => {
            // CRITICAL: Only process the FIRST successful scan
            if (hasScannedRef.current || scanComplete) {
              console.log("Ignoring scan - already processed");
              return;
            }

            console.log("QR Code detected:", decodedText);

            // Mark as scanned IMMEDIATELY to prevent duplicates
            hasScannedRef.current = true;
            setScanComplete(true);

            // Stop scanner immediately
            stopScanner();

            // Process the scan
            onScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Only count errors if we haven't scanned yet
            if (
              !hasScannedRef.current &&
              !scanComplete &&
              errorMessage.includes("NotFoundException")
            ) {
              setScanAttempts((prev) => prev + 1);
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

    // Cleanup on unmount or when isActive changes
    return () => {
      stopScanner();
    };
  }, [isActive, scanComplete]);

  // Stop scanner when isActive becomes false
  useEffect(() => {
    if (!isActive) {
      stopScanner();
    }
  }, [isActive]);

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
    <div ref={containerRef} className="relative w-full max-w-md mx-auto">
      {/* Scanner container with improved styling */}
      <div className="relative overflow-hidden rounded-lg border-2 border-primary/20 bg-black">
        <div id="qr-reader" className="w-full" />

        {/* Scanning overlay */}
        {(isScanning || scanComplete) && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className={`absolute inset-4 border-2 rounded-lg ${
                scanComplete ? "border-green-500 bg-green-500/20" : "border-primary animate-pulse"
              }`}
            >
              {/* Corner indicators */}
              <div
                className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${
                  scanComplete ? "border-green-500" : "border-primary"
                }`}
              ></div>
              <div
                className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${
                  scanComplete ? "border-green-500" : "border-primary"
                }`}
              ></div>
              <div
                className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${
                  scanComplete ? "border-green-500" : "border-primary"
                }`}
              ></div>
              <div
                className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${
                  scanComplete ? "border-green-500" : "border-primary"
                }`}
              ></div>

              {/* Complete indicator */}
              {scanComplete && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Scanned!
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status and instructions */}
      <div className="mt-4 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">
          {!isActive
            ? "Scanner disabled"
            : !isScanning && !scanComplete
              ? "Initializing camera..."
              : scanComplete
                ? "QR code scanned successfully!"
                : "Position QR code within the frame"}
        </p>

        {isScanning && !scanComplete && scanAttempts > 0 && (
          <p className="text-xs text-muted-foreground">Scanning... ({scanAttempts} attempts)</p>
        )}

        {scanComplete && (
          <p className="text-xs text-green-600 font-medium">✓ Ready to submit entry</p>
        )}

        {isScanning && !scanComplete && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Hold your device steady</p>
            <p>• Ensure good lighting</p>
            <p>• Keep QR code flat and clear</p>
          </div>
        )}
      </div>
    </div>
  );
}

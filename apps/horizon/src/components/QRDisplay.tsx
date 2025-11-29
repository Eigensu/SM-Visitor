/**
 * QR Display Component
 * Shows QR code with download/share options
 */
"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "./ui/Button";
import { Download, Share2, Printer } from "lucide-react";
import toast from "react-hot-toast";

interface QRDisplayProps {
  value: string;
  name: string;
  details?: {
    phone?: string;
    purpose?: string;
    validUntil?: string;
  };
}

export function QRDisplay({ value, name, details }: QRDisplayProps) {
  const handleDownload = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `${name.replace(/\s+/g, "_")}_QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast.success("QR code downloaded!");
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `QR Code - ${name}`,
          text: `QR code for ${name}`,
        });
      } catch (error) {
        console.error("Share error:", error);
      }
    } else {
      toast.error("Sharing not supported on this device");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* QR Code */}
      <div className="flex justify-center">
        <div className="rounded-lg border-4 border-purple-100 bg-white p-4">
          <QRCodeSVG id="qr-code" value={value} size={256} level="H" includeMargin={true} />
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div>
          <span className="text-sm font-medium text-gray-600">Name:</span>
          <p className="text-lg font-semibold text-gray-900">{name}</p>
        </div>
        {details?.phone && (
          <div>
            <span className="text-sm font-medium text-gray-600">Phone:</span>
            <p className="text-gray-900">{details.phone}</p>
          </div>
        )}
        {details?.purpose && (
          <div>
            <span className="text-sm font-medium text-gray-600">Purpose:</span>
            <p className="text-gray-900">{details.purpose}</p>
          </div>
        )}
        {details?.validUntil && (
          <div>
            <span className="text-sm font-medium text-gray-600">Valid Until:</span>
            <p className="text-gray-900">{details.validUntil}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleDownload} className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button onClick={handleShare} variant="secondary" className="flex-1">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
        <Button onClick={handlePrint} variant="secondary" className="flex-1">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
    </div>
  );
}

/**
 * Download utilities for QR codes and other files
 */

export const downloadQRCode = (
  dataUrl: string,
  filename: string,
  onSuccess?: () => void,
  onError?: (error: string) => void
) => {
  try {
    console.log("Downloading QR code:", {
      filename,
      isDataUrl: dataUrl.startsWith("data:image/"),
      dataUrlType: dataUrl.split(",")[0],
    });

    // Validate data URL
    if (!dataUrl.startsWith("data:image/")) {
      console.error("Invalid data URL format:", dataUrl.substring(0, 50));
      onError?.("Invalid image format");
      return;
    }

    // Use fetch API to convert data URL to blob (most reliable method)
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        console.log("Converted to blob:", blob.size, "bytes");
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.download = filename.replace(/\s+/g, "_") + ".png";
        downloadLink.href = url;
        downloadLink.style.display = "none";

        document.body.appendChild(downloadLink);
        downloadLink.click();

        // Cleanup
        setTimeout(() => {
          if (document.body.contains(downloadLink)) {
            document.body.removeChild(downloadLink);
          }
          URL.revokeObjectURL(url);
        }, 100);

        console.log("Download triggered successfully");
        onSuccess?.();
      })
      .catch((error) => {
        console.error("Download failed:", error);
        onError?.("Failed to download QR code");
      });
  } catch (error) {
    console.error("Download error:", error);
    onError?.("Failed to download QR code");
  }
};

export const downloadQRFromSVG = (
  svgElement: SVGElement,
  filename: string,
  onSuccess?: () => void,
  onError?: (error: string) => void
) => {
  try {
    console.log("Converting SVG to download:", { filename });
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      onError?.("Canvas not supported");
      return;
    }

    const img = new Image();

    img.onload = () => {
      try {
        canvas.width = 300;
        canvas.height = 300;

        // White background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 300, 300);

        // Draw QR code
        ctx.drawImage(img, 0, 0, 300, 300);

        const pngFile = canvas.toDataURL("image/png");
        console.log("SVG converted to PNG, starting download");
        downloadQRCode(pngFile, filename, onSuccess, onError);
      } catch (error) {
        console.error("Canvas conversion error:", error);
        onError?.("Failed to convert QR code");
      }
    };

    img.onerror = () => {
      console.error("Failed to load SVG image");
      onError?.("Failed to load QR code image");
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  } catch (error) {
    console.error("SVG conversion error:", error);
    onError?.("Failed to process QR code");
  }
};

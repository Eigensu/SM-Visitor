/**
 * ID Photo Capture Component
 * Handles camera/upload for ID card photos (Aadhar/PAN)
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@sm-visitor/ui";
import { uploadsAPI } from "@/lib/api";
import { CreditCard, Camera, Upload, CheckCircle, X } from "lucide-react";
import toast from "react-hot-toast";

interface IDPhotoCaptureProps {
  onPhotoUploaded: (photoUrl: string) => void;
  onPhotoRemoved: () => void;
  uploadedUrl?: string;
}

type State = "idle" | "camera" | "preview";

export function IDPhotoCapture({
  onPhotoUploaded,
  onPhotoRemoved,
  uploadedUrl,
}: IDPhotoCaptureProps) {
  const [state, setState] = useState<State>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("camera");
    } catch {
      toast.error("Could not access camera. Use upload instead.");
    }
  };

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "id_card.jpg", { type: "image/jpeg" });
      setPhotoFile(file);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
      setState("preview");
    }, "image/jpeg");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
    setState("preview");
  };

  const upload = async () => {
    if (!photoFile) return;
    setIsUploading(true);
    try {
      const res = await uploadsAPI.uploadIDCardPhoto(photoFile);
      onPhotoUploaded(res.photo_url);
      toast.success("ID photo uploaded!");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to upload ID photo");
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    stopCamera();
    setPreview(null);
    setPhotoFile(null);
    setState("idle");
    onPhotoRemoved();
  };

  useEffect(
    () => () => {
      stopCamera();
      if (preview) URL.revokeObjectURL(preview);
    },
    []
  );

  // Already uploaded
  if (uploadedUrl) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
        <img src={uploadedUrl} alt="ID card" className="h-14 w-20 rounded object-cover border" />
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <CheckCircle className="h-4 w-4" />
            ID photo uploaded
          </div>
        </div>
        <button onClick={reset} className="rounded-full p-1 hover:bg-green-100">
          <X className="h-4 w-4 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {state === "idle" && (
        <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-5 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Take or upload a photo of the ID card</p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
              className="flex-1"
            >
              <Camera className="mr-1.5 h-4 w-4" />
              Camera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      )}

      {state === "camera" && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="w-full" autoPlay playsInline muted />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                stopCamera();
                setState("idle");
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={capture} className="flex-1">
              Capture
            </Button>
          </div>
        </div>
      )}

      {state === "preview" && preview && (
        <div className="space-y-3">
          <img
            src={preview}
            alt="ID card preview"
            className="w-full rounded-lg border object-cover"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={reset}
              disabled={isUploading}
              className="flex-1"
            >
              Retake
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={upload}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Confirm & Upload"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

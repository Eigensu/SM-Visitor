/**
 * Photo Capture Component
 * Handles camera access and photo capture for new visitors
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@sm-visitor/ui";
import { uploadsAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface PhotoCaptureProps {
  onPhotoUploaded: (photoUrl: string) => void;
}

type CameraState = "idle" | "camera" | "preview";

export function PhotoCapture({ onPhotoUploaded }: PhotoCaptureProps) {
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      // Try with ideal constraints first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prefer back camera for scanning/photos
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("camera");
    } catch (error) {
      console.error("Camera access error:", error);
      // Fallback to user facing camera if environment fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState("camera");
      } catch (retryError) {
        console.error("Retry camera error:", retryError);
        toast.error("Could not access camera. Please use the upload option.");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setCameraState("preview");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
        setCameraState("preview");
      }
    }, "image/jpeg");
  };

  const retakePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setCameraState("idle");
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;

    setIsUploading(true);
    try {
      const response = await uploadsAPI.uploadNewVisitorPhoto(photoFile);
      toast.success("Photo uploaded successfully!");
      onPhotoUploaded(response.photo_url);
    } catch (error: any) {
      console.error("Photo upload error:", error);
      const detail = error.response?.data?.detail;
      const errorMessage = typeof detail === "string" ? detail : "Failed to upload photo";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />

      {/* Idle State */}
      {cameraState === "idle" && (
        <div className="rounded-lg border-2 border-dashed border-border bg-muted p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-600">No photo captured</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={startCamera} className="flex-1">
              Open Camera
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              Upload / Native Cam
            </Button>
          </div>
        </div>
      )}

      {/* Camera State */}
      {cameraState === "camera" && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="w-full" autoPlay playsInline muted />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                stopCamera();
                setCameraState("idle");
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="flex-1">
              Capture
            </Button>
          </div>
        </div>
      )}

      {/* Preview State */}
      {cameraState === "preview" && photoPreview && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg">
            <img src={photoPreview} alt="Captured photo" className="w-full" />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={retakePhoto}
              disabled={isUploading}
              className="ocean-gradient h-11 flex-1 hover:opacity-90"
            >
              Retake
            </Button>
            <Button
              onClick={uploadPhoto}
              isLoading={isUploading}
              className="ocean-gradient h-11 flex-1 hover:opacity-90"
            >
              Confirm & Upload
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  onPhotoUploaded?: (photoUrl: string) => void;
  onFileSelected?: (file: File) => void;
  autoUpload?: boolean;
}

type CameraState = "idle" | "camera" | "preview";

export function PhotoCapture({
  onPhotoUploaded,
  onFileSelected,
  autoUpload = true,
}: PhotoCaptureProps) {
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

  const [isUploaded, setIsUploaded] = useState(false);
  const [photoName, setPhotoName] = useState<string>("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoName(file.name);
      setCameraState("preview");
      setIsUploaded(false);
      if (onFileSelected) onFileSelected(file);
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
        const filename = `visitor_${Date.now()}.jpg`;
        const file = new File([blob], filename, { type: "image/jpeg" });
        setPhotoFile(file);
        setPhotoName(filename);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
        setCameraState("preview");
        setIsUploaded(false);
        if (onFileSelected) onFileSelected(file);
      }
    }, "image/jpeg");
  };

  const retakePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoName("");
    setCameraState("idle");
    setIsUploaded(false);
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;

    // For guard form where we want to give feedback immediately
    setIsUploading(true);
    try {
      const response = await uploadsAPI.uploadNewVisitorPhoto(photoFile);
      toast.success("Photo saved!");
      setIsUploaded(true);
      if (onPhotoUploaded) onPhotoUploaded(response.photo_url);
    } catch (error: any) {
      console.error("Photo upload error:", error);
      toast.error("Failed to save photo");
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
            <Button type="button" onClick={startCamera} className="flex-1">
              Open Camera
            </Button>
            <Button
              type="button"
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
              type="button"
              variant="secondary"
              onClick={() => {
                stopCamera();
                setCameraState("idle");
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="button" onClick={capturePhoto} className="flex-1">
              Capture
            </Button>
          </div>
        </div>
      )}

      {/* Preview State */}
      {cameraState === "preview" && photoPreview && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg">
            <img src={photoPreview} alt="Captured photo" className="w-full" />
            {isUploaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="flex flex-col items-center rounded-2xl bg-white/90 p-4 shadow-2xl">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-900">Photo Saved</p>
                  <p className="max-w-[150px] truncate text-xs text-gray-500">{photoName}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {!isUploaded ? (
              <>
                <Button
                  type="button"
                  onClick={retakePhoto}
                  disabled={isUploading}
                  className="flex-1 border-border bg-muted hover:bg-muted/80"
                  variant="outline"
                >
                  Retake
                </Button>
                <Button
                  type="button"
                  onClick={uploadPhoto}
                  isLoading={isUploading}
                  className="ocean-gradient h-11 flex-1 hover:opacity-90 shadow-lg"
                >
                  Confirm & Save
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={retakePhoto}
                className="w-full border-border bg-muted hover:bg-muted/80"
                variant="outline"
              >
                Change Photo
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

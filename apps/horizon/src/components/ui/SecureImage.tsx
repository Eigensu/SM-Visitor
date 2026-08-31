"use client";

import NextImage from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageOff, Loader2 } from "lucide-react";
import { cloudinaryResized, compressImageFile, isCloudinaryUrl } from "@sm-visitor/ui";
import apiClient, { visitorsAPI } from "../../lib/api";

export type PhotoReuploadTarget = {
  visitorId: string;
  /** Which photo on the visitor record to replace. Defaults to the portrait. */
  field?: "photo" | "id_card";
};

type Props = {
  srcRaw?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
  /**
   * Intrinsic size handed to next/image. The rendered size still comes from
   * `className`; this only tells the optimizer how big a file to fetch.
   */
  width?: number;
  height?: number;
  sizes?: string;
  /**
   * Set when the API has already told us the photo cannot be delivered (its
   * Cloudinary account was replaced), so we skip the doomed request.
   */
  unavailable?: boolean;
  /** Providing this turns the placeholder into a "take it again" action. */
  reupload?: PhotoReuploadTarget;
  onReuploaded?: (photoUrl: string) => void;
};

const isFullUrl = (s?: string | null) => !!s && (s.startsWith("http") || s.startsWith("data:"));
const isObjectId = (s?: string | null) => !!s && /^[a-f0-9]{24}$/i.test(s);

const DEFAULT_SIZE = 256;

type CachedPhoto = {
  url: string;
  expiresAt: number;
};

const photoUrlCache = new Map<string, CachedPhoto>();

const getCachedPhotoUrl = (key: string): string | undefined => {
  const cached = photoUrlCache.get(key);
  if (!cached) return undefined;

  if (cached.expiresAt <= Date.now()) {
    photoUrlCache.delete(key);
    return undefined;
  }

  return cached.url;
};

const cachePhotoUrl = (key: string, url: string) => {
  try {
    const resolved = new URL(url);
    const expiresAt = Number(resolved.searchParams.get("exp") || 0) * 1000;
    if (expiresAt > Date.now()) {
      photoUrlCache.set(key, { url, expiresAt });
    }
  } catch {
    // Ignore malformed URLs and fall back to one-time loading.
  }
};

/**
 * Stands in for a photo we cannot show. It keeps the caller's `className` so
 * the surrounding layout is unchanged whether the photo loads or not, and
 * when a re-upload target is supplied the whole box becomes the button - at
 * avatar sizes there is no room for a label beside it.
 */
function PhotoUnavailable({
  className,
  label,
  reupload,
  onReuploaded,
}: {
  className?: string;
  label: string;
  reupload?: PhotoReuploadTarget;
  onReuploaded?: (photoUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !reupload) return;

    setIsUploading(true);
    try {
      const updated = await visitorsAPI.replaceVisitorPhoto(
        reupload.visitorId,
        await compressImageFile(file),
        reupload.field ?? "photo"
      );
      const nextUrl =
        reupload.field === "id_card" ? updated?.id_card_photo_url : updated?.photo_url;
      if (nextUrl) onReuploaded?.(nextUrl);
    } catch (error) {
      console.error("Failed to replace photo", error);
      const { toast } = await import("sonner");
      toast.error("Could not save the new photo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const body = isUploading ? (
    <Loader2 className="h-1/2 w-1/2 animate-spin text-muted-foreground" />
  ) : (
    <ImageOff className="h-1/2 w-1/2 text-muted-foreground/60" />
  );

  if (!reupload) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={`flex items-center justify-center bg-muted ${className ?? ""}`}
      >
        {body}
      </span>
    );
  }

  return (
    <>
      <input
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        ref={inputRef}
        onChange={handleFile}
      />
      <button
        type="button"
        title={`${label} - click to upload it again`}
        aria-label={`${label} - click to upload it again`}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={`relative flex items-center justify-center border border-dashed border-primary/40 bg-muted transition hover:bg-muted/70 disabled:opacity-60 ${className ?? ""}`}
      >
        {body}
        {!isUploading && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-1/3 min-h-[14px] w-1/3 min-w-[14px] items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Camera className="h-2/3 w-2/3" />
          </span>
        )}
      </button>
    </>
  );
}

export default function SecureImage({
  srcRaw,
  alt = "",
  className,
  fallback,
  width = DEFAULT_SIZE,
  height,
  sizes,
  unavailable = false,
  reupload,
  onReuploaded,
}: Props) {
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!srcRaw) return undefined;
    if (isFullUrl(srcRaw)) return srcRaw as string;
    // other relative paths will be handled after mount
    return undefined;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFailed(false);

    const resolve = async () => {
      if (!srcRaw) return setSrc(undefined);
      if (isFullUrl(srcRaw)) return setSrc(srcRaw as string);

      const cachedUrl = getCachedPhotoUrl(srcRaw);
      if (cachedUrl) {
        if (mounted) setSrc(cachedUrl);
        return;
      }

      // If it's a bare GridFS id, request a signed URL from backend
      if (isObjectId(srcRaw)) {
        try {
          const resp = await apiClient.get(`/uploads/photo/regular/${srcRaw}/signed-url`);
          let signedUrl = resp?.data?.signed_url || "";
          if (signedUrl) {
            try {
              const urlObj = new URL(signedUrl);
              const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(
                /\/$/,
                ""
              );
              signedUrl = `${base}${urlObj.pathname}${urlObj.search}`;
            } catch (e) {
              // Fallback
            }
          }
          if (signedUrl) {
            cachePhotoUrl(srcRaw, signedUrl);
            if (mounted) setSrc(signedUrl);
          }
          return;
        } catch (err) {
          console.error("Failed to fetch signed photo URL", err);
          if (mounted) setFailed(true);
          return;
        }
      }

      // For other relative paths, assume NEXT_PUBLIC_API_URL base
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      if (mounted) setSrc(`${base}${srcRaw.startsWith("/") ? "" : "/"}${srcRaw}`);
    };

    resolve();
    return () => {
      mounted = false;
    };
  }, [srcRaw]);

  const handleReuploaded = useCallback(
    (photoUrl: string) => {
      setFailed(false);
      setSrc(photoUrl);
      onReuploaded?.(photoUrl);
    },
    [onReuploaded]
  );

  // A relative path or a GridFS id has to be resolved against the API before
  // there is anything to render. Showing nothing during that round trip keeps
  // us from flashing "unavailable" at a photo that is about to load fine.
  const isResolving = !src && !failed && Boolean(srcRaw) && !isFullUrl(srcRaw);
  if (isResolving && !unavailable) return null;

  const cannotShow = unavailable || failed || !src;

  if (cannotShow) {
    // A caller-supplied fallback image still wins when there is nothing to
    // offer the user - only the actionable case replaces it.
    if (fallback && !reupload) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={fallback} alt={alt} className={className} />;
    }
    if (!srcRaw && !reupload) return null;
    return (
      <PhotoUnavailable
        className={className}
        label={alt || "Photo unavailable"}
        reupload={reupload}
        onReuploaded={handleReuploaded}
      />
    );
  }

  // Only Cloudinary is registered in next.config remotePatterns, and only
  // Cloudinary URLs benefit from a resize on the way out. Signed API URLs and
  // data URIs stay on a plain <img>.
  if (isCloudinaryUrl(src)) {
    const renderWidth = width;
    const renderHeight = height ?? width;
    return (
      <NextImage
        // Fetch at 2x the drawn size so the optimizer has retina headroom
        // without pulling the full-resolution original across the wire.
        src={cloudinaryResized(src, renderWidth * 2)}
        alt={alt}
        width={renderWidth}
        height={renderHeight}
        sizes={sizes}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        if (fallback) {
          (e.currentTarget as HTMLImageElement).src = fallback;
          return;
        }
        setFailed(true);
      }}
    />
  );
}

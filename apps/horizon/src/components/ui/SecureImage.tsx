import React, { useEffect, useState } from "react";
import apiClient from "../../lib/api";

type Props = {
  srcRaw?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
};

const isFullUrl = (s?: string | null) => !!s && (s.startsWith("http") || s.startsWith("data:"));
const isObjectId = (s?: string | null) => !!s && /^[a-f0-9]{24}$/i.test(s);

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

export default function SecureImage({ srcRaw, alt = "", className, fallback }: Props) {
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!srcRaw) return undefined;
    if (isFullUrl(srcRaw)) return srcRaw as string;
    // other relative paths will be handled after mount
    return undefined;
  });

  useEffect(() => {
    let mounted = true;

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

  if (!src) {
    return fallback ? <img src={fallback} alt={alt} className={className} /> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        if (fallback) (e.currentTarget as HTMLImageElement).src = fallback;
      }}
    />
  );
}

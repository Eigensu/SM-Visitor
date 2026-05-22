import React, { useEffect, useState } from "react";
import apiClient from "@/lib/api";

type Props = {
  srcRaw?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
};

const isFullUrl = (s?: string | null) =>
  !!s && (s.startsWith("http") || s.startsWith("data:") || s.startsWith("blob:"));
const isObjectId = (s?: string | null) => !!s && /^[a-f0-9]{24}$/i.test(s);

export default function SecureImage({ srcRaw, alt = "", className, fallback }: Props) {
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!srcRaw) return undefined;
    if (isFullUrl(srcRaw)) return srcRaw as string;
    return undefined;
  });

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      if (!srcRaw) return setSrc(undefined);
      if (isFullUrl(srcRaw)) return setSrc(srcRaw as string);

      if (isObjectId(srcRaw)) {
        try {
          const resp = await apiClient.get(`/uploads/photo/regular/${srcRaw}/signed-url`);
          if (mounted && resp?.data?.signed_url) setSrc(resp.data.signed_url);
          return;
        } catch (err) {
          console.error("Failed to fetch signed photo URL", err);
        }
      }

      const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      if (mounted) setSrc(`${base}${srcRaw.startsWith("/") ? "" : "/"}${srcRaw}`);
    };

    resolve();
    return () => {
      mounted = false;
    };
  }, [srcRaw]);

  if (!src) return fallback ? <img src={fallback} alt={alt} className={className} /> : null;

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

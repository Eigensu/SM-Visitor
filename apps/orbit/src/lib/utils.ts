import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse backend datetime string as UTC (backend stores naive ISO without 'Z') */
const parseUTCDate = (s: string): Date => {
  if (!s) return new Date();
  const normalized =
    s.endsWith("Z") || s.includes("+") || /\d{2}:\d{2}$/.test(s.slice(-6)) ? s : s + "Z";
  return new Date(normalized);
};

export function formatTime(dateString: string): string {
  return parseUTCDate(dateString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function formatDateTime(dateString: string): string {
  return parseUTCDate(dateString).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function getPhotoUrl(photoPath?: string): string | undefined {
  if (!photoPath) return undefined;

  // Already a full URL or data URI — return as-is
  if (photoPath.startsWith("http") || photoPath.startsWith("data:")) {
    return photoPath;
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // Absolute path starting with /uploads — prepend base only
  if (photoPath.startsWith("/uploads/")) {
    return `${baseUrl}${photoPath}`;
  }

  // Buffer path (relative, e.g. "uuid.jpg")
  if (photoPath.startsWith("uploads/photo/buffer/") || photoPath.includes("/buffer/")) {
    return `${baseUrl}/${photoPath}`;
  }

  // Bare GridFS ObjectId (24-char hex) — route to /uploads/photo/regular/{id}
  if (/^[a-f0-9]{24}$/i.test(photoPath)) {
    return `${baseUrl}/uploads/photo/regular/${photoPath}`;
  }

  // Fallback
  return `${baseUrl}/${photoPath}`;
}

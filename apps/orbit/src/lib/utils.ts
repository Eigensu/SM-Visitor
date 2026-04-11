import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function getPhotoUrl(photoPath?: string): string | undefined {
  if (!photoPath) return undefined;

  if (photoPath.startsWith("http") || photoPath.startsWith("data:")) {
    return photoPath;
  }

  if (photoPath.includes(":\\") || photoPath.startsWith("/")) {
    if (photoPath.startsWith("/")) {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      return `${baseUrl}${photoPath}`;
    }
    return undefined;
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return `${baseUrl}/${photoPath}`;
}

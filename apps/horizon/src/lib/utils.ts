/**
 * Utility functions
 */

/**
 * Parse a backend datetime string as UTC.
 * The backend stores naive ISO strings (no 'Z' / no offset).
 * Without this, browsers treat them as LOCAL time, showing times 5h 30m earlier.
 */
const parseUTCDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  // Append 'Z' if the string has no timezone info
  const normalized =
    dateString.endsWith("Z") ||
    dateString.includes("+") ||
    /\d{2}:\d{2}$/.test(dateString.slice(-6)) // e.g. +05:30
      ? dateString
      : dateString + "Z";
  return new Date(normalized);
};

// Format date/time — all use parseUTCDate for correct IST display
export const formatTime = (dateString: string): string => {
  return parseUTCDate(dateString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

export const formatDate = (dateString: string): string => {
  return parseUTCDate(dateString).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

export const formatDateTime = (dateString: string): string => {
  return parseUTCDate(dateString).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

// Phone number validation
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone);
};

// OTP validation
export const validateOTP = (otp: string): boolean => {
  const otpRegex = /^[0-9]{6}$/;
  return otpRegex.test(otp);
};

// Class name utility
export const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};

// Get status color
export const getStatusColor = (
  status: "pending" | "approved" | "rejected" | "auto_approved"
): string => {
  switch (status) {
    case "approved":
    case "auto_approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// Get status label
export const getStatusLabel = (
  status: "pending" | "approved" | "rejected" | "auto_approved"
): string => {
  switch (status) {
    case "auto_approved":
      return "Auto Approved";
    case "approved":
      return "Approved";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
};

// Capture photo from camera
export const capturePhoto = async (): Promise<File | null> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);

    stream.getTracks().forEach((track) => track.stop());

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
          resolve(file);
        } else {
          resolve(null);
        }
      }, "image/jpeg");
    });
  } catch (error) {
    console.error("Error capturing photo:", error);
    return null;
  }
};
// Get full photo URL
export const getPhotoUrl = (photoPath?: string): string | undefined => {
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

  // Buffer path (relative)
  if (photoPath.startsWith("uploads/photo/buffer/") || photoPath.includes("/buffer/")) {
    return `${baseUrl}/${photoPath}`;
  }

  // Bare GridFS ObjectId (24-char hex) — route to /uploads/photo/regular/{id}
  if (/^[a-f0-9]{24}$/i.test(photoPath)) {
    return `${baseUrl}/uploads/photo/regular/${photoPath}`;
  }

  // Fallback
  return `${baseUrl}/${photoPath}`;
};

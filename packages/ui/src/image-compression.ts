/**
 * Browser-side image downscaling, applied before a photo is uploaded.
 *
 * A phone camera hands us a 3-6 MB, 4000px JPEG. Nothing in either app ever
 * renders a visitor photo larger than a few hundred pixels, and the image CDN
 * bills for storage and for every byte it delivers, so the full-resolution
 * original is pure cost. Shrinking here also keeps the upload itself quick on
 * the patchy mobile connections guards work from.
 *
 * Compression is best-effort by design: any failure returns the original file
 * so a photo is never lost to a canvas quirk on some device.
 */

export type CompressImageOptions = {
  /** Longest edge of the result, in pixels. */
  maxDimension?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
};

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_QUALITY = 0.82;

const canCompress = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof createImageBitmap === "function";

export const compressImageFile = async (
  file: File,
  options: CompressImageOptions = {}
): Promise<File> => {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  if (!canCompress() || !file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    // `from-image` applies the EXIF rotation phones record instead of baking
    // in a sideways portrait.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) return file;

    // A photo that was already small can come back larger after re-encoding.
    if (blob.size >= file.size && scale === 1) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("Image compression failed, uploading the original", error);
    return file;
  } finally {
    bitmap?.close();
  }
};

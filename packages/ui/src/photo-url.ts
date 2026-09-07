/**
 * Helpers for working with stored photo URLs.
 *
 * Visitor photos live in Cloudinary, which bills delivery by the byte. The
 * originals are around 1280px because that is what an ID card scan needs to
 * stay readable, but almost every render is a 48-96px avatar. Asking
 * Cloudinary for a version scaled to the size actually being drawn is the
 * difference between a few hundred KB and a few KB per view.
 */

const CLOUDINARY_HOST = "res.cloudinary.com";
const UPLOAD_MARKER = "/upload/";

/** Widest version we will ever request, matching the stored original. */
const MAX_REQUEST_WIDTH = 1280;

export const isCloudinaryUrl = (url?: string | null): boolean =>
  typeof url === "string" && url.includes(`${CLOUDINARY_HOST}/`);

/** The cloud name embedded in a Cloudinary delivery URL, if there is one. */
export const cloudinaryCloudName = (url?: string | null): string | null => {
  if (!isCloudinaryUrl(url)) return null;
  const match = /res\.cloudinary\.com\/([^/]+)\//.exec(url as string);
  return match ? match[1] : null;
};

/**
 * Rewrite a Cloudinary URL to deliver the photo at `width` pixels.
 *
 * `c_limit` never upscales, so a photo smaller than the requested width comes
 * back untouched, and `q_auto` lets Cloudinary pick the lowest quality that
 * still looks right for the format. A URL that already carries a
 * transformation is left alone rather than having a second one stacked on it.
 */
export const cloudinaryResized = (url: string, width: number): string => {
  if (!isCloudinaryUrl(url)) return url;

  const markerAt = url.indexOf(UPLOAD_MARKER);
  if (markerAt === -1) return url;

  const prefix = url.slice(0, markerAt + UPLOAD_MARKER.length);
  const rest = url.slice(markerAt + UPLOAD_MARKER.length);

  const firstSegment = rest.split("/")[0] ?? "";
  if (/^[a-z]{1,3}_/.test(firstSegment)) return url;

  const requested = Math.min(Math.max(Math.round(width), 1), MAX_REQUEST_WIDTH);
  return `${prefix}c_limit,w_${requested},q_auto/${rest}`;
};

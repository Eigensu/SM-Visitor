import apiClient from "@/lib/api";

export type HorizonAutofillSource = "visit" | "regular";

export interface HorizonAutofillRecord {
  id: string;
  source: HorizonAutofillSource;
  name: string;
  phone: string;
  typeLabel: string;
  photoUrl: string;
  idCardPhotoUrl: string;
  idType: string;
  idNumber: string;
  purpose: string;
  category: string;
  categoryLabel: string;
  vehicleNumber: string;
  vehicleType: string;
  validity: string;
  ownerValue: string;
  raw: any;
}

const toText = (value: unknown, fallback = "") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const toDigits = (value: unknown) => toText(value).replace(/\D/g, "");

const toUpper = (value: unknown) => toText(value).toUpperCase();

export const normalizeHorizonAutofillRecord = (record: any): HorizonAutofillRecord | null => {
  if (!record) return null;

  const source: HorizonAutofillSource =
    record.visitor_id || record.name_snapshot ? "visit" : "regular";
  const isTemporary =
    source === "regular" && (record.pass_type === "temporary" || Boolean(record.qr_validity_hours));
  const name = toText(record.name_snapshot || record.name || record.fullName);
  if (!name) return null;

  const phone = toText(record.phone_snapshot || record.phone || record.phoneNumber);
  const id = toText(
    record.id || record._id || record.visit_id || record.visitor_id || `${source}-${name}-${phone}`
  );

  return {
    id,
    source,
    name,
    phone,
    typeLabel: source === "visit" ? "Guest" : isTemporary ? "Guest" : "Staff",
    photoUrl: toText(record.photo_snapshot_url || record.photo_url || record.photo),
    idCardPhotoUrl: toText(record.id_photo_url || record.id_card_photo_url),
    idType: toText(record.id_type || record.card_type || record.id_card_type),
    idNumber: toText(record.id_number || record.card_number || record.id_card_number),
    purpose: toText(record.purpose || record.default_purpose),
    category: toText(record.category),
    categoryLabel: toText(record.category_label),
    vehicleNumber: toText(record.vehicle_number),
    vehicleType: toText(record.vehicle_type),
    validity: toText(
      record.qr_validity_hours ? `${record.qr_validity_hours}h` : record.qr_expires_at
    ),
    ownerValue: toText(record.owner_id || record.flat_id || record.assigned_owner_id),
    raw: record,
  };
};

export const dedupeHorizonAutofillRecords = (
  records: Array<HorizonAutofillRecord | null | undefined>
) => {
  const seen = new Set<string>();
  return records.filter((record): record is HorizonAutofillRecord => {
    if (!record) return false;
    const key = `${record.source}:${record.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const searchHorizonAutofillRecords = (
  records: HorizonAutofillRecord[],
  query: string,
  field: "name" | "phone" | "id"
) => {
  const value = query.trim();
  if (!value) return [];

  if (field === "name") {
    const normalized = value.toLowerCase();
    return records.filter((record) => record.name.toLowerCase().includes(normalized));
  }

  if (field === "phone") {
    const digits = toDigits(value);
    return records.filter((record) => toDigits(record.phone) === digits);
  }

  const normalized = toUpper(value);
  return records.filter(
    (record) =>
      toUpper(record.idNumber) === normalized ||
      toUpper(record.idType) === normalized ||
      toUpper(record.name) === normalized
  );
};

export const fetchFileFromUrl = async (url: string, filename: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
};

const isFullUrl = (value: string) =>
  value.startsWith("http") || value.startsWith("data:") || value.startsWith("blob:");

const isObjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value);

export const resolveHorizonStoredPhotoUrl = async (srcRaw: string) => {
  const value = srcRaw.trim();
  if (!value) return "";
  if (isFullUrl(value)) {
    return value;
  }

  if (isObjectId(value)) {
    const response = await apiClient.get(`/uploads/photo/regular/${value}/signed-url`);
    let signedUrl = response?.data?.signed_url || "";
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
    return signedUrl;
  }

  const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};

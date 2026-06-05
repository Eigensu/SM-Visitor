import apiClient from "@/lib/api";

export type OrbitAutofillSource = "visit" | "regular";

export interface OrbitAutofillRecord {
  id: string;
  source: OrbitAutofillSource;
  name: string;
  phone: string;
  typeLabel: string;
  photoUrl: string;
  idCardPhotoUrl: string;
  idType: string;
  idNumber: string;
  purpose: string;
  ownerValue: string;
  validity: string;
  vehicleNumber: string;
  vehicleType: string;
  raw: any;
}

const toText = (value: unknown, fallback = "") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const toDigits = (value: unknown) => toText(value).replace(/\D/g, "");

const toUpper = (value: unknown) => toText(value).toUpperCase();

export const normalizeOrbitAutofillRecord = (record: any): OrbitAutofillRecord | null => {
  if (!record) return null;

  const source: OrbitAutofillSource =
    record.source_record_type === "regular_visitor" ? "regular" : "visit";
  const isTemporary =
    source === "visit"
      ? false
      : record.pass_type === "temporary" || Boolean(record.qr_validity_hours);

  const name = toText(
    record.name_snapshot || record.name || record.fullName || record.visitor_name
  );
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
    photoUrl: toText(
      record.photo_snapshot_url || record.photo_url || record.photo || record.visitorPhoto
    ),
    idCardPhotoUrl: toText(record.id_photo_url || record.id_card_photo_url || record.idCardPhoto),
    idType: toText(record.id_type || record.card_type || record.id_card_type || record.idType),
    idNumber: toText(
      record.id_number || record.card_number || record.id_card_number || record.idNumber
    ),
    purpose: toText(record.purpose || record.default_purpose || record.defaultPurpose),
    ownerValue: toText(
      record.owner_id ||
        record.assigned_owner_id ||
        record.flat_id ||
        record.target_flat_ids?.join(", ") ||
        record.valid_flats?.join(", ")
    ),
    validity: toText(
      record.qr_validity_hours
        ? `${record.qr_validity_hours}h`
        : record.qr_expires_at || record.qr_expires_at
    ),
    vehicleNumber: toText(record.vehicle_number || record.vehicleNumber),
    vehicleType: toText(record.vehicle_type || record.vehicleType),
    raw: record,
  };
};

export const dedupeOrbitAutofillRecords = (
  records: Array<OrbitAutofillRecord | null | undefined>
) => {
  const seen = new Set<string>();
  return records.filter((record): record is OrbitAutofillRecord => {
    if (!record) return false;
    const key = `${record.source}:${record.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const searchOrbitAutofillRecords = (
  records: OrbitAutofillRecord[],
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

export const resolveOrbitStoredPhotoUrl = async (srcRaw: string) => {
  const value = srcRaw.trim();
  if (!value) return "";
  if (isFullUrl(value)) {
    return value;
  }

  if (isObjectId(value)) {
    const response = await apiClient.get(`/uploads/photo/regular/${value}/signed-url`);
    return response?.data?.signed_url || "";
  }

  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};

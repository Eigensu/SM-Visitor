import { visitsAPI, visitorsAPI } from "@/lib/api";

export type OrbitRecordSource = "visit" | "regular_visitor";

export interface OrbitRecordDetails {
  id: string;
  sourceRecordType: OrbitRecordSource;
  fullName: string;
  phone: string;
  visitorType: string;
  visitorTypeLabel: string;
  purpose: string;
  flatOwner: string;
  visitorPhoto: string;
  idCardPhoto: string;
  idType: string;
  idNumber: string;
  createdAt: string;
  approvedAt: string;
  entryTime: string;
  exitTime: string;
  status: string;
  qrToken: string;
  qrValidityHours: string;
  qrExpiresAt: string;
  vehicleNumber: string;
  vehicleType: string;
  category: string;
  categoryLabel: string;
  isAllFlats: boolean;
  validFlats: string[];
  targetFlatIds: string[];
  guardName: string;
}

const toText = (value: unknown, fallback = "N/A") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const toOptionalText = (value: unknown) => {
  const text = toText(value, "");
  return text || "";
};

const toList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

const visitorTypeLabel = (visitorType: string) => {
  return visitorType === "regular" ? "Staff" : "Guest";
};

export const normalizeOrbitRecordDetails = (record: any): OrbitRecordDetails => {
  const sourceRecordType = (record?.source_record_type ||
    record?.sourceRecordType ||
    "visit") as OrbitRecordSource;
  const visitorType = toText(
    record?.visitor_type || record?.visitorType,
    sourceRecordType === "visit" ? "guest" : "regular"
  );
  const fullName = toText(
    record?.name_snapshot || record?.name || record?.fullName || record?.visitor_name,
    "Unknown"
  );
  const phone = toText(record?.phone_snapshot || record?.phone || record?.phoneNumber, "");
  const purpose = toText(record?.purpose || record?.default_purpose || record?.defaultPurpose, "");
  const flatOwner = toText(
    record?.owner_id ||
      record?.flat_id ||
      record?.assigned_owner_id ||
      record?.ownerAssignment ||
      record?.target_flat_ids?.join(", ") ||
      record?.valid_flats?.join(", "),
    ""
  );
  const visitorPhoto = toText(
    record?.photo_snapshot_url || record?.photo_url || record?.visitorPhoto,
    ""
  );
  const idCardPhoto = toText(
    record?.id_photo_url || record?.id_card_photo_url || record?.idCardPhoto,
    ""
  );
  const idType = toText(
    record?.id_type || record?.id_card_type || record?.card_type || record?.idType,
    ""
  );
  const idNumber = toText(
    record?.id_number || record?.id_card_number || record?.card_number || record?.idNumber,
    ""
  );
  const createdAt = toText(record?.created_at || record?.createdAt, "");
  const approvedAt = toText(record?.approved_at || record?.approvedAt, "");
  const entryTime = toText(record?.entry_time || record?.entryTime, "");
  const exitTime = toText(record?.exit_time || record?.exitTime, "");
  const status = toText(
    record?.status || record?.approval_status || record?.approvalStatus,
    "pending"
  );
  const qrToken = toText(record?.qr_token || record?.qrToken, "");
  const qrValidityHours = toText(record?.qr_validity_hours || record?.qrValidityHours, "");
  const qrExpiresAt = toText(record?.qr_expires_at || record?.qrExpiresAt, "");
  const vehicleNumber = toText(record?.vehicle_number || record?.vehicleNumber, "");
  const vehicleType = toText(record?.vehicle_type || record?.vehicleType, "");
  const category = toText(record?.category, "");
  const categoryLabel = toText(record?.category_label || record?.categoryLabel, "");
  const isAllFlats = Boolean(record?.is_all_flats || record?.isAllFlats);
  const validFlats = toList(record?.valid_flats || record?.validFlats);
  const targetFlatIds = toList(record?.target_flat_ids || record?.targetFlatIds);
  const guardName = toText(record?.guard_name || record?.guardName, "");

  return {
    id: toText(record?.id || record?._id || record?.visit_id, ""),
    sourceRecordType,
    fullName,
    phone,
    visitorType,
    visitorTypeLabel: visitorTypeLabel(visitorType),
    purpose,
    flatOwner,
    visitorPhoto,
    idCardPhoto,
    idType,
    idNumber,
    createdAt,
    approvedAt,
    entryTime,
    exitTime,
    status,
    qrToken,
    qrValidityHours,
    qrExpiresAt,
    vehicleNumber,
    vehicleType,
    category,
    categoryLabel,
    isAllFlats,
    validFlats,
    targetFlatIds,
    guardName,
  };
};

export const fetchOrbitRecordDetails = async (
  summary: { id: string; source_record_type?: OrbitRecordSource },
  signal?: AbortSignal
) => {
  const source = summary.source_record_type || "visit";
  if (source === "regular_visitor") {
    const response = await visitorsAPI.getRegularVisitor(summary.id, signal);
    return normalizeOrbitRecordDetails(response);
  }

  const response = await visitsAPI.getVisit(summary.id, signal);
  return normalizeOrbitRecordDetails(response);
};

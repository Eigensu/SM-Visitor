"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge, StatusType } from "@/components/shared/StatusBadge";
import { VisitorTimeline, type VisitorTimelineVisit } from "@/components/shared/VisitorTimeline";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  User,
  Car,
  MoreHorizontal,
  Calendar,
  Download,
  Check,
  X,
  Clock as ClockIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SecureImage from "@/components/ui/SecureImage";
import { normalizeApprovalStatus } from "@sm-visitor/hooks";
import {
  visitsAPI,
  visitorsAPI,
  type VisitHistoryItem,
  type RegularVisitorHistoryItem,
} from "@/lib/api";
import { formatDateTime, getDateTimestamp } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  dedupeHorizonAutofillRecords,
  fetchFileFromUrl,
  normalizeHorizonAutofillRecord,
  resolveHorizonStoredPhotoUrl,
  searchHorizonAutofillRecords,
  type HorizonAutofillRecord,
} from "@/lib/autofill";

interface ExtendedVisitHistoryItem extends VisitHistoryItem {
  guard_name?: string;
  approved_at?: string | null;
  id_type?: string;
  id_number?: string;
  vehicle_number?: string;
  vehicle_type?: string;
}

interface ExtendedRegularVisitorHistoryItem extends RegularVisitorHistoryItem {
  qr_token?: string | null;
  default_purpose?: string | null;
  flat_id?: string | null;
  category?: string;
  category_label?: string;
  visitor_type?: string;
  created_by_role?: string;
  pass_type?: string;
  qr_validity_hours?: number | null;
  updated_at?: string | null;
  id_card_type?: string | null;
  id_card_number?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  id_photo_url?: string | null;
  id_card_photo_url?: string | null;
}

interface Visit {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  date: string;
  createdAt: string;
  status: StatusType;
  photo?: string;
  is_all_flats?: boolean;
  target_flat_ids?: string[];
  owner_id: string;
  visitor_type?: "adhoc" | "regular";
  entry_time?: string | null;
  exit_time?: string | null;
  guard_id?: string;
  qr_token?: string | null;
}

interface VisitDetailsData {
  id: string;
  fullName: string;
  phoneNumber: string;
  visitorTypeLabel: string;
  purpose?: string;
  validityPeriod?: string;
  ownerAssignment?: string;
  visitorPhoto?: string;
  cardType?: string;
  cardNumber?: string;
  idCardPhoto?: string;
  createdTime?: string | null;
  approvedTime?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  status: StatusType;
  qrInformation?: string;
  guardInformation?: string;
  qrToken?: string | null;
}

const formatMaybeDateTime = (value?: string | null, fallback = "N/A") =>
  value ? formatDateTime(value) : fallback;

const formatEntryDateTime = (value?: string | null) =>
  value ? formatDateTime(value) : "Not Entered Yet";

const getRegularVisitorTypeLabel = (visitor: {
  pass_type?: string;
  qr_validity_hours?: number | null;
}) => (visitor.pass_type === "temporary" || visitor.qr_validity_hours ? "Guest" : "Staff");

const getValidityLabel = (visitor: { pass_type?: string; qr_validity_hours?: number | null }) => {
  if (visitor.qr_validity_hours) {
    return `${visitor.qr_validity_hours}h Pass`;
  }
  return "Permanent";
};

const toStatusType = (status: string | undefined): StatusType =>
  normalizeApprovalStatus(status) as StatusType;

const mapAdhocVisit = (v: ExtendedVisitHistoryItem): Visit => ({
  id: v.id || v._id || "",
  name: v.name || v.name_snapshot || "Unknown",
  phone: v.phone || v.phone_snapshot || "N/A",
  purpose: v.purpose || "Visit",
  createdAt: v.created_at,
  date: formatDateTime(v.created_at, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }),
  status: toStatusType(v.status),
  photo: v.photo_snapshot_url || undefined,
  is_all_flats: v.is_all_flats,
  target_flat_ids: v.target_flat_ids,
  owner_id: v.owner_id || "",
  visitor_type: "adhoc",
  entry_time: v.entry_time,
  exit_time: v.exit_time,
  guard_id: v.guard_id,
  qr_token: v.qr_token,
});

const mapRegularVisit = (v: ExtendedRegularVisitorHistoryItem): Visit => ({
  id: v.id || v._id || "",
  name: v.name || "Unknown",
  phone: v.phone || "N/A",
  purpose:
    v.pass_type === "temporary" || v.qr_validity_hours
      ? v.default_purpose || "Guest Visit"
      : v.default_purpose || `Staff Registration: ${v.category_label || v.category || "Staff"}`,
  createdAt: v.created_at,
  date: formatDateTime(v.created_at, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }),
  status: toStatusType(v.approval_status),
  photo: v.photo_url || undefined,
  owner_id: v.flat_id || v.assigned_owner_id || v.created_by || "",
  visitor_type: "regular",
  qr_token: v.qr_token,
});

const csvEscape = (value: unknown): string => {
  const stringValue = typeof value === "string" ? value : value == null ? "" : String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/\"/g, '""')}"`;
  }
  return stringValue;
};

export default function Visitors() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adhocVisitMap, setAdhocVisitMap] = useState<Record<string, ExtendedVisitHistoryItem>>({});
  const [regularVisitMap, setRegularVisitMap] = useState<
    Record<string, ExtendedRegularVisitorHistoryItem>
  >({});
  const [timelineVisitId, setTimelineVisitId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<VisitorTimelineVisit | null>(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [detailsVisitId, setDetailsVisitId] = useState<string | null>(null);
  const [detailsData, setDetailsData] = useState<VisitDetailsData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isPreApproveOpen, setIsPreApproveOpen] = useState(false);
  const [isPreApproveSubmitting, setIsPreApproveSubmitting] = useState(false);
  const [preApproveLookupRecords, setPreApproveLookupRecords] = useState<HorizonAutofillRecord[]>(
    []
  );
  const [preApproveLookupLoading, setPreApproveLookupLoading] = useState(true);
  const [preApproveNameMatches, setPreApproveNameMatches] = useState<HorizonAutofillRecord[]>([]);
  const [preApprovePhoneMatches, setPreApprovePhoneMatches] = useState<HorizonAutofillRecord[]>([]);
  const [preApprovePhotoPreviewUrl, setPreApprovePhotoPreviewUrl] = useState<string | null>(null);
  const [preApproveForm, setPreApproveForm] = useState({
    name: "",
    phone: "",
    default_purpose: "",
    category: "other",
    photo: null as File | null,
  });

  const applyPreApproveRecord = async (record: HorizonAutofillRecord) => {
    setPreApproveForm((prev) => ({
      ...prev,
      name: record.name || prev.name,
      phone: record.phone || prev.phone,
      default_purpose: record.purpose || prev.default_purpose,
      category: record.category || prev.category,
    }));

    if (record.photoUrl) {
      try {
        const resolvedPhotoUrl = await resolveHorizonStoredPhotoUrl(record.photoUrl);
        const file = await fetchFileFromUrl(
          resolvedPhotoUrl || record.photoUrl,
          `${record.name || "visitor"}.jpg`
        );
        setPreApproveForm((prev) => ({ ...prev, photo: file }));
        setPreApprovePhotoPreviewUrl(URL.createObjectURL(file));
      } catch (error) {
        console.error("Failed to load pre-approve photo:", error);
      }
    }

    setPreApproveNameMatches([]);
    setPreApprovePhoneMatches([]);
  };

  const renderPreApproveMatches = (matches: HorizonAutofillRecord[]) => {
    if (matches.length <= 1) return null;

    return (
      <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background p-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Multiple matches found
        </p>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {matches.slice(0, 6).map((record) => (
            <button
              key={`${record.source}-${record.id}`}
              type="button"
              onClick={() => void applyPreApproveRecord(record)}
              className="flex w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {record.photoUrl ? (
                  <SecureImage
                    srcRaw={record.photoUrl}
                    alt={record.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{record.name}</p>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {record.typeLabel}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {record.phone || "No phone"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const fetchVisits = async () => {
    try {
      setIsLoading(true);
      const [historyVisits, historyRegularVisitors] = await Promise.all([
        visitsAPI.getHistory(),
        visitorsAPI.getHistoryRegular(),
      ]);

      const adhocMap: Record<string, ExtendedVisitHistoryItem> = {};
      historyVisits.forEach((item) => {
        const id = item.id || item._id;
        if (id) {
          adhocMap[id] = item as ExtendedVisitHistoryItem;
        }
      });

      const regularMap: Record<string, ExtendedRegularVisitorHistoryItem> = {};
      historyRegularVisitors.forEach((item) => {
        const id = item.id || item._id;
        if (id) {
          regularMap[id] = item as ExtendedRegularVisitorHistoryItem;
        }
      });

      setAdhocVisitMap(adhocMap);
      setRegularVisitMap(regularMap);

      const transformedVisits: Visit[] = [
        ...historyVisits.map((item) => mapAdhocVisit(item as ExtendedVisitHistoryItem)),
        ...historyRegularVisitors.map((item) =>
          mapRegularVisit(item as ExtendedRegularVisitorHistoryItem)
        ),
      ].sort((a, b) => getDateTimestamp(b.createdAt) - getDateTimestamp(a.createdAt));

      setVisits(transformedVisits);
    } catch (error) {
      console.error("Failed to fetch visits:", error);
      toast.error("Failed to load visitor history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadLookupRecords = async () => {
      try {
        setPreApproveLookupLoading(true);
        const [activeRegular, pendingRegular, historyRegular] = await Promise.all([
          visitorsAPI.getRegularVisitors(),
          visitorsAPI.getPendingRegular(),
          visitorsAPI.getHistoryRegular(),
        ]);

        const combined = dedupeHorizonAutofillRecords([
          ...activeRegular.map(normalizeHorizonAutofillRecord),
          ...pendingRegular.map(normalizeHorizonAutofillRecord),
          ...historyRegular.map(normalizeHorizonAutofillRecord),
        ]);

        if (isActive) setPreApproveLookupRecords(combined);
      } catch (error) {
        console.error("Failed to load pre-approve lookup records:", error);
      } finally {
        if (isActive) setPreApproveLookupLoading(false);
      }
    };

    loadLookupRecords();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const query = preApproveForm.name.trim();
    if (query.length < 3) {
      setPreApproveNameMatches([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const matches = searchHorizonAutofillRecords(preApproveLookupRecords, query, "name");
      setPreApproveNameMatches(matches);
      if (matches.length === 1) {
        void applyPreApproveRecord(matches[0]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [preApproveForm.name, preApproveLookupRecords]);

  useEffect(() => {
    const digits = preApproveForm.phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPreApprovePhoneMatches([]);
      return;
    }

    const matches = searchHorizonAutofillRecords(preApproveLookupRecords, digits, "phone");
    setPreApprovePhoneMatches(matches);
    if (matches.length === 1) {
      void applyPreApproveRecord(matches[0]);
    }
  }, [preApproveForm.phone, preApproveLookupRecords]);

  useEffect(() => {
    if (searchParams.get("action") === "preapprove") {
      setIsPreApproveOpen(true);
    }
  }, [searchParams]);

  const closePreApproveModal = () => {
    setIsPreApproveOpen(false);
    if (searchParams.get("action") === "preapprove") {
      router.replace("/visitors");
    }
  };

  const handleApprove = async (visitId: string) => {
    try {
      await visitsAPI.approve(visitId);
      toast.success("Visit approved successfully");
      fetchVisits(); // Refresh list
    } catch (error) {
      console.error("Failed to approve visit:", error);
      toast.error("Failed to approve visit");
    }
  };

  const handleReject = async (visitId: string) => {
    if (!confirm("Are you sure you want to reject this visitor?")) return;

    try {
      await visitsAPI.reject(visitId);
      toast.success("Visit rejected");
      fetchVisits(); // Refresh list
    } catch (error) {
      console.error("Failed to reject visit:", error);
      toast.error("Failed to reject visit");
    }
  };

  const handleViewTimeline = async (visit: Visit) => {
    if (visit.visitor_type === "regular") {
      toast("Timeline is available only for ad-hoc visits");
      return;
    }

    try {
      setTimelineVisitId(visit.id);
      setIsLoadingTimeline(true);
      const data = await visitsAPI.getVisitDetails(visit.id);
      setTimelineData(data);
    } catch (error) {
      console.error("Failed to fetch timeline:", error);
      toast.error("Failed to load timeline");
      setTimelineVisitId(null);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  const closeTimeline = () => {
    setTimelineVisitId(null);
    setTimelineData(null);
  };

  const handleViewDetails = async (visit: Visit) => {
    try {
      setDetailsVisitId(visit.id);
      setIsLoadingDetails(true);

      if (visit.visitor_type === "adhoc") {
        const detail = await visitsAPI.getVisitDetails(visit.id);
        const adhocRaw = adhocVisitMap[visit.id];

        setDetailsData({
          id: visit.id,
          fullName: detail.name || detail.name_snapshot || visit.name,
          phoneNumber: detail.phone || detail.phone_snapshot || visit.phone,
          visitorTypeLabel: "Guest",
          validityPeriod: "N/A",
          ownerAssignment: visit.is_all_flats
            ? "Society"
            : visit.target_flat_ids?.join(", ") || detail.owner_id || visit.owner_id,
          visitorPhoto: detail.photo || detail.photo_snapshot_url || visit.photo,
          cardType: (detail as ExtendedVisitHistoryItem).id_type || undefined,
          cardNumber: (detail as ExtendedVisitHistoryItem).id_number || undefined,
          idCardPhoto: (detail as ExtendedVisitHistoryItem).id_photo_url || undefined,
          createdTime: detail.created_at,
          approvedTime: detail.approved_at || detail.updated_at,
          status: toStatusType(detail.status),
          entryTime: detail.entry_time || visit.entry_time,
          exitTime: detail.exit_time || visit.exit_time,
          purpose: detail.purpose || visit.purpose,
          qrToken: detail.qr_token || visit.qr_token,
          qrInformation: detail.qr_token ? "QR pass available" : "Manual",
          guardInformation: detail.guard_name || detail.guard_id || visit.guard_id,
        });
      } else {
        const regularRaw = regularVisitMap[visit.id] || {};
        const isTemporaryGuest = Boolean(
          regularRaw.pass_type === "temporary" || regularRaw.qr_validity_hours
        );

        setDetailsData({
          id: visit.id,
          fullName: regularRaw.name || visit.name,
          phoneNumber: regularRaw.phone || visit.phone || "N/A",
          visitorTypeLabel: getRegularVisitorTypeLabel(regularRaw),
          validityPeriod: getValidityLabel(regularRaw),
          ownerAssignment: regularRaw.flat_id || visit.owner_id,
          visitorPhoto: regularRaw.photo_url || visit.photo,
          cardType:
            regularRaw.card_type || regularRaw.id_card_type || regularRaw.id_type || undefined,
          cardNumber:
            regularRaw.card_number ||
            regularRaw.id_card_number ||
            regularRaw.id_number ||
            undefined,
          idCardPhoto: regularRaw.id_card_photo_url || regularRaw.id_photo_url || undefined,
          createdTime: regularRaw.created_at || visit.createdAt,
          approvedTime: regularRaw.approved_at || regularRaw.updated_at || visit.createdAt,
          status: visit.status,
          entryTime: undefined,
          exitTime: undefined,
          purpose: regularRaw.default_purpose || visit.purpose,
          qrToken: regularRaw.qr_token || visit.qr_token,
          qrInformation: regularRaw.qr_token
            ? `${isTemporaryGuest ? `${regularRaw.qr_validity_hours}h pass` : "QR pass"} available`
            : "N/A",
          guardInformation:
            regularRaw.guard_name || regularRaw.created_by_role || regularRaw.created_by || "N/A",
        });
      }
    } catch (error) {
      console.error("Failed to fetch visitor details:", error);
      toast.error("Failed to load visitor details");
      setDetailsVisitId(null);
      setDetailsData(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setDetailsVisitId(null);
    setDetailsData(null);
  };

  const handleExportReports = () => {
    if (filteredVisitors.length === 0) {
      toast("No records available to export");
      return;
    }

    const headers = [
      "Full Name",
      "Phone Number",
      "Visitor Type",
      "Purpose",
      "Validity Period",
      "Owner / Flat Assignment",
      "Visitor Photo",
      "Card Type",
      "Card Number",
      "ID Card Photo",
      "Created Time",
      "Approved Time",
      "Entry Time",
      "Exit Time",
      "Status",
      "QR Information",
      "Guard Information",
    ];

    const rows = filteredVisitors.map((visitor) => {
      const regularRaw = regularVisitMap[visitor.id] || {};
      const adhocRaw = adhocVisitMap[visitor.id] || {};

      const isRegular = visitor.visitor_type === "regular";
      const isTemporaryGuest = Boolean(
        regularRaw.pass_type === "temporary" || regularRaw.qr_validity_hours
      );
      const visitorType = isRegular ? getRegularVisitorTypeLabel(regularRaw) : "Guest";
      const ownerAssignment = isRegular
        ? visitor.owner_id || regularRaw.flat_id || regularRaw.assigned_owner_id || "N/A"
        : visitor.is_all_flats
          ? "Society"
          : visitor.target_flat_ids?.join(", ") || visitor.owner_id || adhocRaw.owner_id || "N/A";
      const visitorPhoto = isRegular
        ? visitor.photo || regularRaw.photo_url || ""
        : visitor.photo || adhocRaw.photo_snapshot_url || "";
      const cardType = isRegular
        ? regularRaw.card_type || regularRaw.id_card_type || "N/A"
        : adhocRaw.id_type || "N/A";
      const cardNumber = isRegular
        ? regularRaw.card_number || regularRaw.id_card_number || "N/A"
        : adhocRaw.id_number || "N/A";
      const idCardPhoto = isRegular
        ? regularRaw.id_card_photo_url || regularRaw.id_photo_url || "N/A"
        : adhocRaw.id_photo_url || "N/A";
      const createdTime = isRegular
        ? formatMaybeDateTime(regularRaw.created_at || visitor.createdAt, "N/A")
        : formatMaybeDateTime(adhocRaw.created_at || visitor.createdAt, "N/A");
      const approvedTime = isRegular
        ? formatMaybeDateTime(regularRaw.approved_at || regularRaw.updated_at, "N/A")
        : formatMaybeDateTime(adhocRaw.approved_at || adhocRaw.updated_at, "N/A");
      const entryRaw = visitor.entry_time || adhocRaw.entry_time || null;
      const exitRaw = visitor.exit_time || adhocRaw.exit_time || null;
      const guardInfo =
        (adhocRaw as { guard_name?: string }).guard_name ||
        adhocRaw.guard_id ||
        visitor.guard_id ||
        regularRaw.guard_name ||
        regularRaw.created_by_role ||
        regularRaw.created_by ||
        "N/A";
      const qrInfo = isRegular
        ? regularRaw.qr_token
          ? `${isTemporaryGuest ? `${regularRaw.qr_validity_hours}h pass` : "QR pass"} available`
          : "N/A"
        : adhocRaw.qr_token
          ? "QR pass available"
          : "N/A";

      return [
        visitor.name,
        visitor.phone,
        visitorType,
        isRegular ? regularRaw.default_purpose || visitor.purpose : visitor.purpose,
        isRegular ? getValidityLabel(regularRaw) : "N/A",
        ownerAssignment,
        visitorPhoto,
        cardType,
        cardNumber,
        idCardPhoto,
        createdTime,
        approvedTime,
        entryRaw ? formatDateTime(entryRaw) : "Not Entered Yet",
        exitRaw ? formatDateTime(exitRaw) : "N/A",
        visitor.status,
        qrInfo,
        guardInfo,
      ];
    });

    const csvContent = [
      headers.map((header) => csvEscape(header)).join(","),
      ...rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const filename = `visitor-history-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.csv`;

    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("History report downloaded");
  };

  const handlePreApproveSubmit = async () => {
    if (!preApproveForm.name.trim()) {
      toast.error("Visitor name is required");
      return;
    }
    if (!preApproveForm.photo) {
      toast.error("Visitor photo is required");
      return;
    }

    if (preApproveForm.phone && preApproveForm.phone.replace(/\D/g, "").length < 10) {
      toast.error("Phone number must be at least 10 digits");
      return;
    }

    try {
      setIsPreApproveSubmitting(true);
      await visitorsAPI.createRegular({
        name: preApproveForm.name.trim(),
        phone: preApproveForm.phone.trim() || undefined,
        default_purpose: preApproveForm.default_purpose.trim() || undefined,
        category: preApproveForm.category,
        photo: preApproveForm.photo,
      });

      toast.success("Visitor pre-approved successfully");
      setPreApproveForm({
        name: "",
        phone: "",
        default_purpose: "",
        category: "other",
        photo: null,
      });
      setPreApprovePhotoPreviewUrl(null);
      closePreApproveModal();
      await fetchVisits();
    } catch (error: any) {
      console.error("Failed to pre-approve visitor:", error);
      const detail = error?.response?.data?.detail;
      let errorMessage = "Failed to pre-approve visitor";
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map((d: any) => `${d.loc?.join(".")} - ${d.msg}`).join(", ");
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsPreApproveSubmitting(false);
    }
  };

  const filteredVisitors = visits.filter(
    (visitor) =>
      visitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.phone.includes(searchQuery)
  );

  return (
    <PageContainer
      title="Visitor Management"
      description="View and manage all visitor records"
      action={
        <Button
          className="ocean-gradient hover:opacity-90"
          onClick={() => setIsPreApproveOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Pre-approve Visitor
        </Button>
      }
    >
      {/* Search & Filters */}
      <GlassCard className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background/50 pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Calendar className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExportReports}>
              <Download className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <GlassCard className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold">Visitor</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Purpose</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                          {visitor.photo ? (
                            <SecureImage
                              srcRaw={visitor.photo}
                              alt={visitor.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{visitor.name}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {visitor.visitor_type === "regular" ? "REGULAR" : "ADHOC"}
                            </span>
                            {visitor.is_all_flats && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                BROADCAST
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            To:{" "}
                            {visitor.is_all_flats
                              ? "Society"
                              : visitor.target_flat_ids?.join(", ") || visitor.owner_id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{visitor.phone}</TableCell>
                    <TableCell>{visitor.purpose}</TableCell>
                    <TableCell className="text-muted-foreground">{visitor.date}</TableCell>
                    <TableCell>
                      <StatusBadge status={visitor.status} />
                    </TableCell>
                    <TableCell>
                      {visitor.status === "pending" && visitor.visitor_type === "adhoc" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleApprove(visitor.id)}
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleReject(visitor.id)}
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewTimeline(visitor)}
                            disabled={visitor.visitor_type === "regular"}
                          >
                            <ClockIcon className="mr-2 h-4 w-4" />
                            {visitor.visitor_type === "regular"
                              ? "Timeline Unavailable"
                              : "View Timeline"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewDetails(visitor)}>
                            View Details
                          </DropdownMenuItem>
                          {visitor.status !== "pending" && (
                            <DropdownMenuItem>Block Visitor</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filteredVisitors.map((visitor) => (
              <GlassCard key={visitor.id} hover className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                      {visitor.photo ? (
                        <SecureImage
                          srcRaw={visitor.photo}
                          alt={visitor.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-primary" strokeWidth={1.5} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{visitor.name}</p>
                      <p className="text-sm text-muted-foreground">{visitor.phone}</p>
                    </div>
                  </div>
                  <StatusBadge status={visitor.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{visitor.purpose}</span>
                    <span className="text-[10px] font-medium text-primary">
                      To:{" "}
                      {visitor.is_all_flats
                        ? "Society"
                        : visitor.target_flat_ids?.join(", ") || visitor.owner_id}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{visitor.date}</span>
                </div>

                {visitor.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      size="sm"
                      onClick={() => handleApprove(visitor.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:bg-red-50"
                      size="sm"
                      onClick={() => handleReject(visitor.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewDetails(visitor)}
                  >
                    View Details
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>

          {filteredVisitors.length === 0 && (
            <GlassCard className="py-12 text-center">
              <p className="text-muted-foreground">No visitors found matching your search</p>
            </GlassCard>
          )}
        </>
      )}

      {/* Timeline Modal */}
      <Dialog open={timelineVisitId !== null} onOpenChange={(open) => !open && closeTimeline()}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Visitor Timeline</DialogTitle>
          </DialogHeader>
          {isLoadingTimeline ? (
            <div className="flex h-60 items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : timelineData ? (
            <VisitorTimeline visit={timelineData} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={detailsVisitId !== null} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent
          className="max-h-[90vh] w-[95vw] max-w-6xl overflow-hidden p-0 sm:w-[92vw]"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Visitor Details</DialogTitle>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex h-60 items-center justify-center px-6 pb-6">
              <Spinner size="lg" />
            </div>
          ) : detailsData ? (
            <div className="max-h-[calc(90vh-5rem)] overflow-y-auto px-6 pb-6 pr-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                    {detailsData.visitorPhoto ? (
                      <SecureImage
                        srcRaw={detailsData.visitorPhoto}
                        alt={detailsData.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {detailsData.fullName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{detailsData.phoneNumber}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {detailsData.visitorTypeLabel.toUpperCase()}
                      </span>
                      <StatusBadge status={detailsData.status} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-border/70 p-4">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Basic Details
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Full Name
                        </p>
                        <p className="mt-1 text-sm text-foreground">{detailsData.fullName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Phone Number
                        </p>
                        <p className="mt-1 text-sm text-foreground">{detailsData.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Visitor Type
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.visitorTypeLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Purpose
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.purpose || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Validity Period
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.validityPeriod || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Owner / Flat Assignment
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.ownerAssignment || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Photos
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Visitor Photo
                        </p>
                        <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                          {detailsData.visitorPhoto ? (
                            <SecureImage
                              srcRaw={detailsData.visitorPhoto}
                              alt={detailsData.fullName}
                              className="h-44 w-full bg-black/5 object-contain"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          ID Card Photo
                        </p>
                        <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                          {detailsData.idCardPhoto ? (
                            <SecureImage
                              srcRaw={detailsData.idCardPhoto}
                              alt={`${detailsData.fullName} ID Card`}
                              className="h-44 w-full bg-black/5 object-contain"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Identity Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Card Type
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.cardType || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Card Number
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.cardNumber || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Visit Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Created Time
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatMaybeDateTime(detailsData.createdTime, "N/A")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Approved Time
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatMaybeDateTime(detailsData.approvedTime, "N/A")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Entry Time
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatEntryDateTime(detailsData.entryTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Exit Time
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatMaybeDateTime(detailsData.exitTime, "N/A")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Status
                        </p>
                        <p className="mt-1 text-sm text-foreground">{detailsData.status}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          QR Information
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.qrInformation || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Guard Information
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {detailsData.guardInformation || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Pre-approve Visitor Modal */}
      <Dialog open={isPreApproveOpen} onOpenChange={(open) => !open && closePreApproveModal()}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Pre-approve Visitor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Visitor Name"
              value={preApproveForm.name}
              onChange={(e) => setPreApproveForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter visitor name"
            />
            {!preApproveLookupLoading && renderPreApproveMatches(preApproveNameMatches)}
            <Input
              label="Phone Number"
              value={preApproveForm.phone}
              onChange={(e) =>
                setPreApproveForm((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                }))
              }
              placeholder="Optional"
            />
            {!preApproveLookupLoading && renderPreApproveMatches(preApprovePhoneMatches)}
            <Input
              label="Purpose"
              value={preApproveForm.default_purpose}
              onChange={(e) =>
                setPreApproveForm((prev) => ({ ...prev, default_purpose: e.target.value }))
              }
              placeholder="Optional"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Category</label>
              <select
                value={preApproveForm.category}
                onChange={(e) =>
                  setPreApproveForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="other">Other</option>
                <option value="maid">Maid</option>
                <option value="cook">Cook</option>
                <option value="driver">Driver</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Photo</label>
              <div className="space-y-3 rounded-md border border-dashed border-border p-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file =
                      e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
                    setPreApproveForm((prev) => ({
                      ...prev,
                      photo: file,
                    }));
                    setPreApprovePhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {preApprovePhotoPreviewUrl && (
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
                      <img
                        src={preApprovePhotoPreviewUrl}
                        alt={preApproveForm.name || "Visitor photo preview"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Selected visitor photo</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closePreApproveModal}>
                Cancel
              </Button>
              <Button
                className="ocean-gradient hover:opacity-90"
                onClick={handlePreApproveSubmit}
                disabled={isPreApproveSubmitting}
              >
                {isPreApproveSubmitting ? <Spinner size="sm" /> : <Car className="mr-2 h-4 w-4" />}
                {isPreApproveSubmitting ? "Submitting..." : "Pre-approve"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

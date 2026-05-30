/**
 * New Regular Visitor Page
 * Form for guards to register regular visitors (maids, cooks, etc.)
 * Requires owner approval.
 */
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@sm-visitor/ui";
import { PhotoCapture } from "@/components/PhotoCapture";
import { OwnerSelect } from "@/components/OwnerSelect";
import { GlassCard } from "@/components/GlassCard";
import { visitorsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, UserCheck, Clock, CreditCard, Camera, User } from "lucide-react";
import {
  dedupeOrbitAutofillRecords,
  fetchFileFromUrl,
  normalizeOrbitAutofillRecord,
  resolveOrbitStoredPhotoUrl,
  searchOrbitAutofillRecords,
  type OrbitAutofillRecord,
} from "@/lib/autofill";
import SecureImage from "@/components/ui/SecureImage";

const ID_CARD_TYPES = [
  { id: "aadhaar", label: "Aadhaar" },
  { id: "pan", label: "PAN" },
  { id: "voter", label: "Voter ID" },
  { id: "driving", label: "Driving Licence" },
  { id: "passport", label: "Passport" },
  { id: "other", label: "Other" },
];

function RegularVisitorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "staff";
  const isGuestMode = mode === "guest";

  const [step, setStep] = useState<"form" | "pending">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<File | null>(null);
  const [idCardPhotoBlob, setIdCardPhotoBlob] = useState<File | null>(null);
  const [lookupRecords, setLookupRecords] = useState<OrbitAutofillRecord[]>([]);
  const [isLookupLoading, setIsLookupLoading] = useState(true);
  const [nameMatches, setNameMatches] = useState<OrbitAutofillRecord[]>([]);
  const [phoneMatches, setPhoneMatches] = useState<OrbitAutofillRecord[]>([]);
  const [idMatches, setIdMatches] = useState<OrbitAutofillRecord[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    owner_id: "",
    default_purpose: "",
    validity_hours: "24",
    id_card_type: "aadhaar",
    id_card_number: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearMatches = () => {
    setNameMatches([]);
    setPhoneMatches([]);
    setIdMatches([]);
  };

  const applyLookupRecord = async (record: OrbitAutofillRecord) => {
    setFormData((prev) => ({
      ...prev,
      name: record.name || prev.name,
      phone: record.phone || prev.phone,
      owner_id:
        record.raw.owner_id || record.raw.assigned_owner_id || record.raw.flat_id || prev.owner_id,
      default_purpose: record.purpose || prev.default_purpose,
      validity_hours:
        isGuestMode && record.raw.qr_validity_hours
          ? String(record.raw.qr_validity_hours)
          : prev.validity_hours,
      id_card_type: record.idType || prev.id_card_type,
      id_card_number: record.idNumber || prev.id_card_number,
    }));

    if (record.photoUrl) {
      try {
        const resolvedPhotoUrl = await resolveOrbitStoredPhotoUrl(record.photoUrl);
        const file = await fetchFileFromUrl(
          resolvedPhotoUrl || record.photoUrl,
          `${record.name || "visitor"}.jpg`
        );
        setPhotoBlob(file);
      } catch (error) {
        console.error("Failed to load visitor photo for autofill:", error);
        setPhotoBlob(null);
      }
    } else {
      setPhotoBlob(null);
    }

    if (record.idCardPhotoUrl) {
      try {
        const resolvedIdUrl = await resolveOrbitStoredPhotoUrl(record.idCardPhotoUrl);
        const file = await fetchFileFromUrl(
          resolvedIdUrl || record.idCardPhotoUrl,
          `${record.name || "id-card"}.jpg`
        );
        setIdCardPhotoBlob(file);
      } catch (error) {
        console.error("Failed to load ID photo for autofill:", error);
        setIdCardPhotoBlob(null);
      }
    } else {
      setIdCardPhotoBlob(null);
    }

    clearMatches();
  };

  const renderMatches = (matches: OrbitAutofillRecord[]) => {
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
              onClick={() => void applyLookupRecord(record)}
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

  useEffect(() => {
    let isActive = true;

    const loadLookupRecords = async () => {
      try {
        setIsLookupLoading(true);
        const [activeRegular, pendingRegular, historyRegular] = await Promise.all([
          visitorsAPI.getRegularVisitors(),
          visitorsAPI.getPendingRegular(),
          visitorsAPI.getHistoryRegular(),
        ]);

        const combined = dedupeOrbitAutofillRecords([
          ...activeRegular.map(normalizeOrbitAutofillRecord),
          ...pendingRegular.map(normalizeOrbitAutofillRecord),
          ...historyRegular.map(normalizeOrbitAutofillRecord),
        ]);

        if (isActive) {
          setLookupRecords(combined);
        }
      } catch (error) {
        console.error("Failed to load autofill records:", error);
      } finally {
        if (isActive) {
          setIsLookupLoading(false);
        }
      }
    };

    loadLookupRecords();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const query = formData.name.trim();
    if (query.length < 3) {
      setNameMatches([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const matches = searchOrbitAutofillRecords(lookupRecords, query, "name");
      setNameMatches(matches);
      if (matches.length === 1) {
        void applyLookupRecord(matches[0]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [formData.name, lookupRecords]);

  useEffect(() => {
    const digits = formData.phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneMatches([]);
      return;
    }

    const matches = searchOrbitAutofillRecords(lookupRecords, digits, "phone");
    setPhoneMatches(matches);
    if (matches.length === 1) {
      void applyLookupRecord(matches[0]);
    }
  }, [formData.phone, lookupRecords]);

  useEffect(() => {
    const value = formData.id_card_number.trim();
    if (!value) {
      setIdMatches([]);
      return;
    }

    const matches = searchOrbitAutofillRecords(lookupRecords, value, "id");
    setIdMatches(matches);
    if (matches.length === 1) {
      void applyLookupRecord(matches[0]);
    }
  }, [formData.id_card_number, lookupRecords]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.owner_id) newErrors.owner_id = "Owner assignment is required";
    if (!photoBlob) newErrors.photo = "Photo is required";
    if (!formData.id_card_number.trim()) newErrors.id_card_number = "ID card number is required";
    if (!idCardPhotoBlob) newErrors.id_card_photo = "ID card photo is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("phone", formData.phone);
      data.append("flat_id", formData.owner_id);
      data.append(
        "default_purpose",
        formData.default_purpose || (isGuestMode ? "Guest Visit" : "visitor")
      );
      data.append("id_card_type", formData.id_card_type);
      data.append("id_card_number", formData.id_card_number);

      if (isGuestMode) {
        data.append("qr_validity_hours", formData.validity_hours);
      }

      if (photoBlob) {
        data.append("photo", photoBlob, "visitor.jpg");
      }

      if (idCardPhotoBlob) {
        data.append("id_card_photo", idCardPhotoBlob, "id_card.jpg");
      }

      await visitorsAPI.createRegularByGuard(data);
      setStep("pending");
      toast.success("Registration request sent to owner!");
    } catch (error: any) {
      console.error("Submit error:", error);
      const detail = error.response?.data?.detail;
      let errorMessage = "Failed to submit registration";

      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map((d: any) => `${d.loc.join(".")}: ${d.msg}`).join(", ");
      } else if (typeof detail === "object" && detail !== null) {
        errorMessage = JSON.stringify(detail);
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <GlassCard className="max-w-md p-8">
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${isGuestMode ? "bg-orange-500/10 text-orange-500" : "bg-pending/10 text-pending"}`}
          >
            {isGuestMode ? <Clock className="h-10 w-10" /> : <UserCheck className="h-10 w-10" />}
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">
            {isGuestMode ? "Pass Requested" : "Registration Sent"}
          </h2>
          <p className="mb-8 text-muted-foreground">
            The registration request for <strong>{formData.name}</strong> has been sent to the owner
            for approval. Once approved, the visitor will be active.
          </p>
          <Button onClick={() => router.push("/dashboard")} className="ocean-gradient w-full">
            Back to Dashboard
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-foreground">
                {isGuestMode ? "Issue Temporary Pass" : "Register Staff Member"}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <GlassCard>
            <h2 className="mb-4 border-b pb-2 text-lg font-semibold text-foreground">
              Basic Details
            </h2>
            <div className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Enter visitor's full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={errors.name}
                required
              />
              {!isLookupLoading && renderMatches(nameMatches)}

              <Input
                label="Phone Number"
                placeholder="Enter 10-digit phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
              />
              {!isLookupLoading && renderMatches(phoneMatches)}

              {isGuestMode && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Validity Period <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["6", "12", "18", "24"].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setFormData({ ...formData, validity_hours: hours })}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          formData.validity_hours === hours
                            ? "border-orange-500 bg-orange-500/10 text-orange-500 shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="mb-4 border-b pb-2 text-lg font-semibold text-foreground">
              Flat Assignment
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Select the flat/owner this visitor belongs to.
            </p>
            <OwnerSelect
              value={formData.owner_id}
              onChange={(val) => setFormData({ ...formData, owner_id: val })}
              error={errors.owner_id}
            />
          </GlassCard>

          <GlassCard>
            <h2 className="mb-4 border-b pb-2 text-lg font-semibold text-foreground">
              Visitor Photo
            </h2>
            <PhotoCapture
              initialFile={photoBlob}
              autoUpload={false}
              onFileSelected={(file) => setPhotoBlob(file)}
            />
            {errors.photo && <p className="mt-2 text-xs text-destructive">{errors.photo}</p>}
          </GlassCard>

          <GlassCard>
            <h2 className="mb-4 flex items-center gap-2 border-b pb-2 text-lg font-semibold text-foreground">
              <CreditCard className="h-5 w-5 text-primary" />
              Identity Card
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Card Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ID_CARD_TYPES.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, id_card_type: card.id })}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        formData.id_card_type === card.id
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {card.label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Card Number"
                placeholder={`Enter ${ID_CARD_TYPES.find((c) => c.id === formData.id_card_type)?.label} number`}
                value={formData.id_card_number}
                onChange={(e) =>
                  setFormData({ ...formData, id_card_number: e.target.value.toUpperCase() })
                }
                error={errors.id_card_number}
                required
              />
              {!isLookupLoading && renderMatches(idMatches)}

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Camera className="h-4 w-4" />
                  Photo of ID Card <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Take a clear photo of the identity card.
                </p>
                <PhotoCapture
                  initialFile={idCardPhotoBlob}
                  autoUpload={false}
                  onFileSelected={(file) => setIdCardPhotoBlob(file)}
                />
                {errors.id_card_photo && (
                  <p className="mt-2 text-xs text-destructive">{errors.id_card_photo}</p>
                )}
              </div>
            </div>
          </GlassCard>

          <Button
            type="submit"
            className={`h-12 w-full text-lg font-semibold ${isGuestMode ? "bg-orange-600 hover:bg-orange-700" : "ocean-gradient"}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : isGuestMode ? "Issue 24h Pass" : "Send for Approval"}
          </Button>
        </form>
      </main>
    </div>
  );
}

export default function NewRegularVisitorPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center p-4">Loading...</div>}
    >
      <RegularVisitorContent />
    </Suspense>
  );
}

/**
 * New Regular Visitor Page
 * Form for guards to register regular visitors (maids, cooks, etc.)
 * Requires owner approval.
 */
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { PhotoCapture } from "@/components/PhotoCapture";
import { OwnerSelect } from "@/components/OwnerSelect";
import { GlassCard } from "@/components/GlassCard";
import { visitorsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, UserCheck, Clock, ShieldCheck } from "lucide-react";

const CATEGORIES = [
  { id: "maid", label: "Maid" },
  { id: "cook", label: "Cook" },
  { id: "driver", label: "Driver" },
  { id: "delivery", label: "Delivery" },
  { id: "other", label: "Other" },
];

export default function NewRegularVisitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "staff"; // default to staff
  const isGuestMode = mode === "guest";

  const [step, setStep] = useState<"form" | "pending">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    category: isGuestMode ? "other" : "maid",
    owner_id: "",
    default_purpose: "",
    validity_hours: "24", // Default to 24 for guests
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.owner_id) newErrors.owner_id = "Owner assignment is required";
    if (!photoBlob) newErrors.photo = "Photo is required";

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
      data.append("category", formData.category);
      data.append("flat_id", formData.owner_id);
      data.append(
        "default_purpose",
        formData.default_purpose || (isGuestMode ? "Guest Visit" : formData.category)
      );

      // Only append qr_validity_hours if in guest mode to avoid sending empty strings
      if (isGuestMode) {
        data.append("qr_validity_hours", formData.validity_hours);
      }

      if (photoBlob) {
        data.append("photo", photoBlob, "visitor.jpg");
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
            className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full mx-auto ${isGuestMode ? "bg-orange-500/10 text-orange-500" : "bg-pending/10 text-pending"}`}
          >
            {isGuestMode ? <Clock className="h-10 w-10" /> : <UserCheck className="h-10 w-10" />}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isGuestMode ? "Pass Requested" : "Registration Sent"}
          </h2>
          <p className="text-muted-foreground mb-8">
            The registration request for <strong>{formData.name}</strong> has been sent to the owner
            for approval. Once approved, the visitor will be active.
          </p>
          <Button onClick={() => router.push("/dashboard")} className="w-full ocean-gradient">
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
            <h2 className="mb-4 text-lg font-semibold text-foreground border-b pb-2">
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        formData.category === cat.id
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

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
            <h2 className="mb-4 text-lg font-semibold text-foreground border-b pb-2">
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
            <h2 className="mb-4 text-lg font-semibold text-foreground border-b pb-2">
              Visitor Photo
            </h2>
            <PhotoCapture autoUpload={false} onFileSelected={(file) => setPhotoBlob(file)} />
            {errors.photo && <p className="mt-2 text-xs text-destructive">{errors.photo}</p>}
          </GlassCard>

          <Button
            type="submit"
            className={`w-full h-12 text-lg font-semibold ${isGuestMode ? "bg-orange-600 hover:bg-orange-700" : "ocean-gradient"}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : isGuestMode ? "Issue 24h Pass" : "Send for Approval"}
          </Button>
        </form>
      </main>
    </div>
  );
}

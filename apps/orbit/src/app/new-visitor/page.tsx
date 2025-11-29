/**
 * New Visitor Page
 * Form for registering new visitors with photo capture
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { PhotoCapture } from "@/components/PhotoCapture";
import { OwnerSelect } from "@/components/OwnerSelect";
import { WaitingScreen } from "@/components/WaitingScreen";
import { visitsAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

type FormStep = "form" | "waiting" | "success" | "rejected";

export default function NewVisitorPage() {
  const router = useRouter();
  const { updateVisitStatus } = useStore();

  const [step, setStep] = useState<FormStep>("form");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    purpose: "",
    owner_id: "",
    photo_url: "",
  });
  const [visit, setVisit] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listen for visit status changes via store
  useEffect(() => {
    if (visit && step === "waiting") {
      // This will be updated by SSE
      const checkStatus = setInterval(() => {
        // In real implementation, the SSE will update the store
        // and we can check the visit status here
      }, 1000);

      return () => clearInterval(checkStatus);
    }
  }, [visit, step]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.phone && !/^[0-9]{10}$/.test(formData.phone)) {
      newErrors.phone = "Phone must be 10 digits";
    }

    if (!formData.purpose.trim()) {
      newErrors.purpose = "Purpose is required";
    }

    if (!formData.owner_id) {
      newErrors.owner_id = "Owner/Flat is required";
    }

    if (!formData.photo_url) {
      newErrors.photo_url = "Photo is required";
    }

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
      const response = await visitsAPI.startVisit({
        name: formData.name,
        phone: formData.phone || undefined,
        photo_url: formData.photo_url,
        owner_id: formData.owner_id,
        purpose: formData.purpose,
      });

      setVisit(response);
      setStep("waiting");
      toast.success("Visit request sent to owner!");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.response?.data?.detail || "Failed to submit visit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproved = () => {
    setStep("success");
    toast.success("Visit approved! Visitor can enter.");
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  const handleRejected = () => {
    setStep("rejected");
    toast.error("Visit rejected by owner");
  };

  const handleTimeout = () => {
    toast.error("Request timed out. Owner did not respond.");
    router.push("/dashboard");
  };

  const handleCancel = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-gray-900">New Visitor</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Visitor Information</h2>

              <div className="space-y-4">
                <Input
                  label="Name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                  required
                  placeholder="Enter visitor name"
                />

                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  error={errors.phone}
                  placeholder="Enter 10-digit phone number (optional)"
                />

                <Input
                  label="Purpose"
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  error={errors.purpose}
                  required
                  placeholder="e.g., Delivery, Guest visit"
                />

                <OwnerSelect
                  value={formData.owner_id}
                  onChange={(ownerId) => setFormData({ ...formData, owner_id: ownerId })}
                  error={errors.owner_id}
                />
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Visitor Photo <span className="text-red-500">*</span>
              </h2>
              <PhotoCapture
                onPhotoUploaded={(photoUrl) => setFormData({ ...formData, photo_url: photoUrl })}
              />
              {errors.photo_url && <p className="mt-2 text-sm text-red-600">{errors.photo_url}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
              Submit Visit Request
            </Button>
          </form>
        )}

        {step === "waiting" && visit && (
          <WaitingScreen
            visit={visit}
            onApproved={handleApproved}
            onRejected={handleRejected}
            onTimeout={handleTimeout}
            onCancel={handleCancel}
          />
        )}

        {step === "success" && (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Visit Approved!</h2>
            <p className="mt-2 text-gray-600">Visitor can now enter the premises.</p>
            <p className="mt-4 text-sm text-gray-500">Redirecting to dashboard...</p>
          </div>
        )}

        {step === "rejected" && (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Visit Rejected</h2>
            <p className="mt-2 text-gray-600">The owner has declined this visit request.</p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={handleCancel} className="flex-1">
                Back to Dashboard
              </Button>
              <Button onClick={() => setStep("form")} className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

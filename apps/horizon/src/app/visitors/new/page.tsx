/**
 * Add New Regular Visitor Page
 * Form to create a new regular visitor with photo upload
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { visitorsAPI, uploadsAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { QRDisplay } from "@/components/QRDisplay";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { ArrowLeft, Upload } from "lucide-react";

export default function NewVisitorPage() {
  const router = useRouter();
  const { addRegularVisitor } = useStore();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    default_purpose: "",
    photo_id: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdVisitor, setCreatedVisitor] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
      }
    },
  });

  const handleUploadPhoto = async () => {
    if (!photoFile) return;

    setIsUploading(true);
    try {
      const response = await uploadsAPI.uploadRegularVisitorPhoto(photoFile);
      setFormData({ ...formData, photo_id: response.photo_id });
      toast.success("Photo uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.phone || !/^[0-9]{10}$/.test(formData.phone))
      newErrors.phone = "Valid 10-digit phone number is required";
    if (!formData.default_purpose.trim()) newErrors.default_purpose = "Purpose is required";
    if (!formData.photo_id) newErrors.photo_id = "Photo is required";

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
      const visitor = await visitorsAPI.createRegular(formData);
      addRegularVisitor(visitor);
      setCreatedVisitor(visitor);
      setShowQRModal(true);
      toast.success("Regular visitor created successfully!");
    } catch (error: any) {
      console.error("Create error:", error);
      toast.error(error.response?.data?.detail || "Failed to create visitor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-purple-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/visitors")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-gray-900">Add Regular Visitor</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="bg-white">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Name"
                type="text"
                placeholder="Enter visitor name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={errors.name}
                required
              />

              <Input
                label="Phone"
                type="tel"
                placeholder="Enter 10-digit phone number"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                error={errors.phone}
                required
              />

              <Input
                label="Default Purpose"
                type="text"
                placeholder="e.g., Daily housekeeping, Driver"
                value={formData.default_purpose}
                onChange={(e) => setFormData({ ...formData, default_purpose: e.target.value })}
                error={errors.default_purpose}
                required
              />

              {/* Photo Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Photo <span className="text-red-500">*</span>
                </label>

                {!photoPreview ? (
                  <div
                    {...getRootProps()}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                      isDragActive
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-300 hover:border-purple-400"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      {isDragActive ? "Drop photo here" : "Drag & drop photo or click to browse"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="mx-auto h-48 w-48 rounded-lg object-cover"
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                          setFormData({ ...formData, photo_id: "" });
                        }}
                        className="flex-1"
                      >
                        Change Photo
                      </Button>
                      {!formData.photo_id && (
                        <Button
                          type="button"
                          onClick={handleUploadPhoto}
                          isLoading={isUploading}
                          className="flex-1"
                        >
                          Upload Photo
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {errors.photo_id && <p className="mt-1 text-sm text-red-600">{errors.photo_id}</p>}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isSubmitting}
                disabled={!formData.photo_id}
              >
                Create Regular Visitor
              </Button>
            </form>
          </div>
        </Card>
      </main>

      {/* QR Modal */}
      <Modal
        isOpen={showQRModal}
        onClose={() => {
          setShowQRModal(false);
          router.push("/visitors");
        }}
        title="Regular Visitor Created!"
        size="md"
      >
        {createdVisitor && (
          <div className="space-y-6">
            <p className="text-center text-gray-600">
              QR code generated successfully. Save or share this QR code with the visitor.
            </p>
            <QRDisplay
              value={createdVisitor.qr_token}
              name={createdVisitor.name}
              details={{
                phone: createdVisitor.phone,
                purpose: createdVisitor.default_purpose,
                validUntil: "Permanent",
              }}
            />
            <Button onClick={() => router.push("/visitors")} className="w-full">
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

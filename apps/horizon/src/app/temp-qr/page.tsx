/**
 * Temporary QR Generation Page
 * Generate temporary QR codes for guests
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tempQRAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { QRDisplay } from "@/components/QRDisplay";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

export default function TempQRPage() {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [validityHours, setValidityHours] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<any>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsGenerating(true);
    try {
      const qr = await tempQRAPI.generate({
        guest_name: guestName || undefined,
        validity_hours: validityHours,
      });

      setGeneratedQR(qr);
      toast.success("QR code generated successfully!");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.response?.data?.detail || "Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAnother = () => {
    setGeneratedQR(null);
    setGuestName("");
    setValidityHours(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-purple-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-gray-900">Generate Guest QR Code</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {!generatedQR ? (
          <Card className="bg-white">
            <div className="p-6">
              <form onSubmit={handleGenerate} className="space-y-6">
                <Input
                  label="Guest Name (Optional)"
                  type="text"
                  placeholder="Enter guest name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Validity Period
                  </label>
                  <select
                    value={validityHours}
                    onChange={(e) => setValidityHours(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={3}>3 Hours</option>
                    <option value={6}>6 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours</option>
                  </select>
                </div>

                <Button type="submit" className="w-full" size="lg" isLoading={isGenerating}>
                  Generate QR Code
                </Button>
              </form>
            </div>
          </Card>
        ) : (
          <Card className="bg-white">
            <div className="p-6">
              <h2 className="mb-6 text-center text-xl font-bold text-gray-900">
                Guest QR Code Generated
              </h2>

              <QRDisplay
                value={generatedQR.token}
                name={generatedQR.guest_name || "Guest"}
                details={{
                  validUntil: format(new Date(generatedQR.expires_at), "PPp"),
                }}
              />

              <div className="mt-6">
                <Button onClick={handleGenerateAnother} variant="secondary" className="w-full">
                  Generate Another QR Code
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

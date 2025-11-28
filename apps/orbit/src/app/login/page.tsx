/**
 * Login Page - OTP Authentication
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import { validatePhone, validateOTP } from "@/lib/utils";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useStore();

  const [phone, setPhone] = useState("");
  const [otp, setOTP] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validatePhone(phone)) {
      setErrors({ phone: "Please enter a valid 10-digit phone number" });
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.login(phone);
      toast.success("OTP sent successfully!");
      setStep("otp");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateOTP(otp)) {
      setErrors({ otp: "Please enter a valid 6-digit OTP" });
      return;
    }

    setIsLoading(true);
    try {
      const data = await authAPI.verify(phone, otp);

      // Check if user is a guard
      if (data.user.role !== "guard") {
        toast.error("Access denied. This app is for guards only.");
        setIsLoading(false);
        return;
      }

      login(data.user, data.token);
      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Orbit Guard</h1>
            <p className="mt-2 text-gray-600">Visitor Management System</p>
          </div>

          {/* Phone Step */}
          {step === "phone" && (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <Input
                label="Phone Number"
                type="tel"
                placeholder="Enter 10-digit phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                error={errors.phone}
                required
                autoFocus
              />

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Send OTP
              </Button>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <p className="mb-4 text-sm text-gray-600">
                  OTP sent to <span className="font-semibold">{phone}</span>
                </p>
                <Input
                  label="Enter OTP"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOTP(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  error={errors.otp}
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setStep("phone");
                    setOTP("");
                    setErrors({});
                  }}
                >
                  Change Number
                </Button>
                <Button type="submit" className="flex-1" size="lg" isLoading={isLoading}>
                  Verify OTP
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          SM-Visitor Management System v0.2.0
        </p>
      </div>
    </div>
  );
}

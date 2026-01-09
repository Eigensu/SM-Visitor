/**
 * Login Page - Username/Password Authentication for Guards
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { GlassCard } from "@/components/GlassCard";
import { authAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useStore();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formData, setFormData] = useState({
    phone: "",
    password: "",
    name: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = "Phone number must be 10 digits";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (mode === "signup" && !formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      let data;

      if (mode === "signup") {
        data = await authAPI.signup({
          phone: formData.phone,
          password: formData.password,
          name: formData.name,
          role: "guard",
        });
        toast.success("Account created successfully!");
      } else {
        data = await authAPI.login(formData.phone, formData.password);
        toast.success("Login successful!");
      }

      // Check if user is a guard
      if (data.user.role !== "guard") {
        toast.error("Access denied. This app is for guards only.");
        return;
      }

      login(data.user, data.access_token);
      router.push("/dashboard");
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMessage =
        typeof detail === "string" ? detail : "Login failed. Please check your credentials.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <GlassCard>
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="ocean-gradient mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-primary/20">
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

          {/* Mode Toggle */}
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-white text-primary shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-white text-primary shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <Input
                label="Name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={errors.name}
                required
                autoFocus
              />
            )}

            <Input
              label="Phone Number"
              type="tel"
              placeholder="Enter 10-digit phone number"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                setFormData({ ...formData, phone: value });
              }}
              error={errors.phone}
              required
              autoFocus={mode === "login"}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
              required
            />

            <Button
              type="submit"
              className="ocean-gradient h-11 w-full hover:opacity-90"
              disabled={isLoading}
            >
              {mode === "signup" ? "Create Account" : "Login"}
            </Button>
          </form>
        </GlassCard>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          SM-Visitor Management System v1.0.0
        </p>
      </div>
    </div>
  );
}

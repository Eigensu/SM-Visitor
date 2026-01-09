"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { GlassCard } from "@/components/shared/GlassCard";
import { Spinner } from "@/components/shared/Spinner";
import { authAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Home, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Login() {
  const router = useRouter();
  const { login } = useStore();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formData, setFormData] = useState({
    phone: "",
    password: "",
    name: "",
    flatId: "",
  });
  const [loading, setLoading] = useState(false);
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

    if (mode === "signup") {
      if (!formData.name.trim()) {
        newErrors.name = "Name is required";
      }

      if (!formData.flatId.trim()) {
        newErrors.flatId = "Flat ID is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      let data;

      if (mode === "signup") {
        data = await authAPI.signup({
          phone: formData.phone,
          password: formData.password,
          name: formData.name,
          role: "owner",
          flat_id: formData.flatId,
        });
        toast.success("Account created successfully!");
      } else {
        data = await authAPI.login(formData.phone, formData.password);
        toast.success("Login successful!");
      }

      // Check if user is an owner
      if (data.user.role !== "owner") {
        toast.error("Access denied. This app is for residents only.");
        return;
      }

      login(data.user, data.access_token);
      router.push("/");
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMessage =
        typeof detail === "string"
          ? detail
          : "Authentication failed. Please check your credentials.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/2 -top-1/2 h-full w-full rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="ocean-gradient mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-primary/20"
          >
            <Home className="h-8 w-8 text-primary-foreground" strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Horizon</h1>
          <p className="mt-1 text-muted-foreground">Resident Portal</p>
        </div>

        <GlassCard className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex rounded-lg bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-card text-primary shadow-sm"
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
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  Name
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background/50"
                  autoFocus
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter 10-digit phone number"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData({ ...formData, phone: value });
                }}
                className="bg-background/50"
                autoFocus={mode === "login"}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            {mode === "signup" && (
              <div className="space-y-2">
                <label htmlFor="flatId" className="text-sm font-medium text-foreground">
                  Flat ID
                </label>
                <Input
                  id="flatId"
                  type="text"
                  placeholder="e.g., A-401, B-102"
                  value={formData.flatId}
                  onChange={(e) => setFormData({ ...formData, flatId: e.target.value })}
                  className="bg-background/50"
                />
                {errors.flatId && <p className="text-sm text-destructive">{errors.flatId}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-background/50"
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="ocean-gradient h-11 w-full hover:opacity-90"
              disabled={loading}
            >
              {loading ? (
                <Spinner
                  size="sm"
                  className="border-primary-foreground/20 border-t-primary-foreground"
                />
              ) : (
                <>
                  {mode === "signup" ? "Create Account" : "Sign In"}
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
                </>
              )}
            </Button>
          </form>
        </GlassCard>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          SM-Visitor Management System v1.0.0
        </p>
      </motion.div>
    </div>
  );
}

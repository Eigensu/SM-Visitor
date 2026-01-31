/**
 * Login Page - Phone/Password Authentication for Guards
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { GlassCard } from "@/components/GlassCard";
import { authAPI } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isAuthLoading } = useStore();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formData, setFormData] = useState({
    phone: "",
    password: "",
    name: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      console.log("Already authenticated, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // Show loading while checking auth state
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

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
    console.log("Starting login attempt...");

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
        console.log("Attempting login with phone:", formData.phone);
        data = await authAPI.login(formData.phone, formData.password);
        console.log("Login successful:", data);
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
      console.error("Login error caught:", error);
      console.error("Error response:", error.response);
      console.error("Error status:", error.response?.status);
      console.error("Error data:", error.response?.data);

      let errorMessage = "Authentication failed. Please check your credentials.";

      if (error.response?.status === 401) {
        const detail = error.response?.data?.detail;
        console.log("401 error detail:", detail);
        if (typeof detail === "string") {
          errorMessage = detail;
        } else {
          errorMessage = "Invalid phone number or password. Please try again.";
        }
      } else if (error.response?.status === 422) {
        errorMessage = "Invalid input. Please check your phone number and password.";
      } else if (error.response?.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (!error.response) {
        errorMessage = "Network error. Please check your connection.";
      }

      console.log("Showing toast with message:", errorMessage);
      toast.error(errorMessage);
    } finally {
      console.log("Setting loading to false");
      setIsLoading(false);
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
            <ShieldCheck className="h-8 w-8 text-primary-foreground" strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">Orbit Guard</h1>
          <p className="mt-1 text-muted-foreground">Visitor Management System</p>
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
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Loading...</span>
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

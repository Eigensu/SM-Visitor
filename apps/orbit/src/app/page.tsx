/**
 * Home Page - Redirect to login or dashboard
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Spinner } from "@sm-visitor/ui";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useStore();
  const [isMounted, setIsMounted] = useState(false);

  // Wait for client-side mount (SSEProvider hydration)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Don't redirect until after hydration has a chance to run
    if (!isMounted) return;

    // Small delay to allow SSEProvider hydration to complete
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isMounted, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

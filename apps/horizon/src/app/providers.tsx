"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { setUser, setToken } = useStore();

  useEffect(() => {
    // Hydrate user from local storage
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setToken(token);
        setUser(user);
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

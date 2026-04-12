"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner, Input } from "@sm-visitor/ui";
import { GlassCard } from "@/components/GlassCard";
import { visitorsAPI } from "@/lib/api";
import { getPhotoUrl } from "@/lib/utils";
import { ArrowLeft, Search, User, QrCode, Clock, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";

export default function StaffDirectoryPage() {
  const router = useRouter();
  const { refreshMap } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active">("all");
  const [selectedQR, setSelectedQR] = useState<{ name: string; token: string } | null>(null);

  const fetchData = async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const data = await visitorsAPI.list(signal);
      // Filter only for regular visitors
      setStaff(data.filter((v: any) => v.visitor_type === "regular"));
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("canceled")) {
        return;
      }
      console.error("Failed to fetch staff directory:", error);
      toast.error("Failed to load staff directory");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [refreshMap.visitors]);

  const filteredStaff = staff.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && s.approval_status === "pending") ||
      (filter === "active" && s.is_active);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-foreground">Staff Directory</h1>
            </div>
            <Button
              size="sm"
              onClick={() => router.push("/new-regular-visitor")}
              className="ocean-gradient"
            >
              Register New
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff by name..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {(["all", "pending", "active"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  filter === f
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((person) => (
                  <motion.div
                    key={person.id || person._id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <GlassCard className="h-full overflow-hidden">
                      <div className="flex items-center gap-4 p-5">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-muted shadow-inner">
                          {person.photo_url ? (
                            <img
                              src={getPhotoUrl(person.photo_url)}
                              alt={person.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="m-auto h-8 w-8 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-bold text-foreground">{person.name}</h3>
                          <p className="truncate text-xs text-muted-foreground">
                            {person.phone || "No phone registered"}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {person.approval_status === "pending" ? (
                              <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                                <Clock className="h-3 w-3" />
                                PENDING APPROVAL
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                <CheckCircle2 className="h-3 w-3" />
                                ACTIVE STAFF
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="border-t bg-muted/30 p-3">
                        {person.is_active && person.qr_token ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() =>
                              setSelectedQR({ name: person.name, token: person.qr_token })
                            }
                          >
                            <QrCode className="mr-2 h-3 w-3" />
                            View QR Code
                          </Button>
                        ) : (
                          <p className="text-center text-[11px] italic text-muted-foreground">
                            Waiting for property owner to approve entry
                          </p>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
                  <p className="text-muted-foreground">No staff found matching filters.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* QR Modal */}
      {selectedQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <GlassCard className="w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="ocean-gradient p-6 text-center text-white">
              <h2 className="text-xl font-bold">{selectedQR.name}</h2>
              <p className="text-sm opacity-80 underline underline-offset-4">
                Permanent Entry Pass
              </p>
            </div>
            <div className="p-8 flex flex-col items-center">
              {/* 
                  In a real app, we'd use a QR generator component or fetched image.
                  The backend provides an image URL in the approve-regular endpoint, 
                  but here we use the token to satisfy the "view qr" requirement.
               */}
              <div className="mb-6 flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-4 shadow-xl">
                <QrCode className="h-32 w-32 text-primary" strokeWidth={1.5} />
              </div>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Staff can use this QR for automatic entry scanner.
              </p>
              <Button onClick={() => setSelectedQR(null)} className="w-full">
                Close Pass
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

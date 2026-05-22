"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner, Input } from "@sm-visitor/ui";
import { GlassCard } from "@/components/GlassCard";
import { visitorsAPI } from "@/lib/api";
import { getPhotoUrl } from "@/lib/utils";
import SecureImage from "@/components/ui/SecureImage";
import { normalizeApprovalStatus } from "@sm-visitor/hooks";
import {
  ArrowLeft,
  Search,
  User,
  QrCode,
  Clock,
  CheckCircle2,
  Trash2,
  Home,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the pending registration for ${name}?`)) return;

    try {
      await visitorsAPI.deleteRegular(id);
      toast.success("Registration request deleted");
      setStaff((prev) => prev.filter((s) => (s.id || s._id) !== id));
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to delete request");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [refreshMap.visitors]);

  const filteredStaff = staff.filter((s) => {
    const nameMatch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const flatMatch = s.flat_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const roleMatch = s.category_label?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSearch = nameMatch || flatMatch || roleMatch;
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && normalizeApprovalStatus(s.approval_status) === "pending") ||
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
              className="ocean-gradient shadow-md"
            >
              Register New
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, flat, or role..."
              className="pl-10 h-12 rounded-xl shadow-sm border-muted-foreground/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {(["all", "pending", "active"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
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
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((person) => (
                  <motion.div
                    key={person.id || person._id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <GlassCard className="h-full group hover:ring-2 hover:ring-primary/20 transition-all border-none shadow-lg">
                      <div className="p-7">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-muted shadow-sm border-2 border-white/50">
                              {person.photo_url ? (
                                <SecureImage
                                  srcRaw={person.photo_url}
                                  alt={person.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="m-auto h-8 w-8 text-muted-foreground/50" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-bold text-foreground text-base leading-tight">
                                {person.name}
                              </h3>
                              <p className="truncate text-xs font-medium text-muted-foreground">
                                {person.phone || "No contact info"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {normalizeApprovalStatus(person.approval_status) === "pending" ? (
                              <span className="flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-0.5 text-[9px] font-black text-orange-700 uppercase tracking-tight">
                                <Clock className="h-3 w-3" />
                                Review
                              </span>
                            ) : (
                              <span
                                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-tight ${person.qr_validity_hours ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                              >
                                {person.qr_validity_hours ? (
                                  <Clock className="h-3 w-3" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                                {person.qr_validity_hours
                                  ? `${person.qr_validity_hours}h Pass`
                                  : "Permanent"}
                              </span>
                            )}

                            <button
                              onClick={() => {
                                console.log("🖱️ [CLICK DELETE] id:", person.id || person._id);
                                handleDelete(person.id || person._id, person.name);
                              }}
                              className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4 border-t pt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-2 font-medium">
                              <Briefcase className="h-4 w-4" /> Role:
                            </span>
                            <span className="font-extrabold text-foreground">
                              {person.category_label || person.category || "Staff"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-2 font-medium">
                              <Home className="h-4 w-4" /> Flat:
                            </span>
                            <span className="font-extrabold text-foreground">
                              {person.flat_id || "Common Area"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/10 p-4 mt-auto border-t border-white/5">
                        {person.is_active && person.qr_token ? (
                          <Button
                            variant="secondary"
                            size="lg"
                            className="w-full font-bold bg-white text-primary rounded-xl shadow-md hover:bg-white/90"
                            onClick={() =>
                              setSelectedQR({ name: person.name, token: person.qr_token })
                            }
                          >
                            <QrCode className="mr-2 h-5 w-5" />
                            Entry Pass
                          </Button>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em] flex items-center justify-center gap-2">
                              Awaiting Resident Approval
                            </p>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center">
                  <div className="bg-muted/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">No Staff Records Found</h3>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Try adjusting your filters or searching for a different name/flat.
                  </p>
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
                {staff.find((s) => s.qr_token === selectedQR.token)?.qr_validity_hours
                  ? `Temporary ${staff.find((s) => s.qr_token === selectedQR.token)?.qr_validity_hours}h Pass`
                  : "Permanent Entry Pass"}
              </p>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="mb-6 flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-4 shadow-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedQR.token || "invalid")}`}
                  alt="Staff QR Code"
                  className="h-40 w-40"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      const icon = document.createElement("div");
                      icon.innerHTML = "⚠️";
                      icon.className = "text-4xl";
                      parent.appendChild(icon);
                    }
                  }}
                />
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

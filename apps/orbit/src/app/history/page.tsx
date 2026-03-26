/**
 * History Page
 * Displays today's visits with search and filter capabilities
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { StatusBadge } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { GlassCard } from "@/components/GlassCard";
import { visitsAPI } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { useStore } from "@/lib/store";
import toast from "react-hot-toast";
import { ArrowLeft, Search, X, Phone, User, Clock, Shield, CreditCard } from "lucide-react";

interface Visit {
  id: string;
  visitor_id?: string;
  name_snapshot: string;
  phone_snapshot?: string;
  photo_snapshot_url: string;
  purpose: string;
  owner_id: string;
  guard_id: string;
  guard_name?: string;
  entry_time?: string;
  exit_time?: string;
  status: "pending" | "approved" | "rejected" | "auto_approved";
  is_all_flats?: boolean;
  valid_flats?: string[];
  target_flat_ids?: string[];
  id_type?: string;
  id_number?: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { todayVisits, setTodayVisits } = useStore();
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    if (statusParam) setStatusFilter(statusParam);
  }, []);

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    filterVisits();
  }, [todayVisits, searchQuery, statusFilter]);

  const fetchVisits = async () => {
    try {
      const response = await visitsAPI.getTodayVisits();
      setTodayVisits(response);
    } catch (error: any) {
      console.error("Failed to fetch visits:", error);
      toast.error("Failed to load visits");
    } finally {
      setIsLoading(false);
    }
  };

  const filterVisits = () => {
    let filtered = [...todayVisits];
    if (searchQuery) {
      filtered = filtered.filter((v) =>
        v.name_snapshot.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        filtered = filtered.filter((v) => v.entry_time && !v.exit_time);
      } else {
        filtered = filtered.filter((v) => v.status === statusFilter);
      }
    }
    setFilteredVisits(filtered);
  };

  const handleViewDetails = async (visitId: string) => {
    setIsLoadingDetails(true);
    try {
      const details = await visitsAPI.getVisit(visitId);
      setSelectedVisit(details);
    } catch (error: any) {
      console.error("Failed to fetch visit details:", error);
      toast.error("Failed to load visit details");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCheckout = async (visitId: string) => {
    try {
      await visitsAPI.checkout(visitId);
      toast.success("Visitor checked out successfully!");
      fetchVisits();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to checkout visitor");
    }
  };

  const handleCancel = async (visitId: string) => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    try {
      await visitsAPI.cancelVisit(visitId);
      toast.success("Request cancelled successfully");
      fetchVisits();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to cancel request");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-foreground">Today's Log</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by visitor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border py-2.5 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="auto_approved">Auto Approved</option>
            <option value="active">Active Now</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <GlassCard className="p-4">
            <p className="text-sm text-gray-600">Total Visits</p>
            <p className="text-2xl font-bold text-gray-900">{todayVisits.length}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {todayVisits.filter((v) => v.status === "pending").length}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">
              {
                todayVisits.filter((v) => v.status === "approved" || v.status === "auto_approved")
                  .length
              }
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-sm text-gray-600">Active Now</p>
            <p className="text-2xl font-bold text-primary">
              {todayVisits.filter((v) => v.entry_time && !v.exit_time).length}
            </p>
          </GlassCard>
        </div>

        {/* Visits List */}
        {filteredVisits.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-gray-600">
              {searchQuery || statusFilter !== "all"
                ? "No visits match your filters"
                : "No visits recorded today"}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {filteredVisits.map((visit) => (
              <GlassCard key={visit.id} className="p-4 hover:shadow-lg">
                <div className="flex items-center gap-4">
                  <img
                    src={visit.photo_snapshot_url}
                    alt={visit.name_snapshot}
                    className="h-16 w-16 rounded-full border-2 border-gray-200 object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{visit.name_snapshot}</h3>
                          {visit.is_all_flats && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                              Broadcast
                            </span>
                          )}
                        </div>
                        {visit.phone_snapshot && (
                          <p className="text-sm text-gray-600">{visit.phone_snapshot}</p>
                        )}
                        <p className="text-sm font-medium text-primary">
                          To:{" "}
                          {visit.is_all_flats
                            ? "Society (Random 3)"
                            : visit.target_flat_ids?.join(", ") || visit.owner_id}
                        </p>
                        <p className="text-sm text-gray-600">{visit.purpose}</p>
                      </div>
                      <StatusBadge status={visit.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>Entry: {visit.entry_time ? formatTime(visit.entry_time) : "N/A"}</span>
                      {visit.exit_time && <span>Exit: {formatTime(visit.exit_time)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleViewDetails(visit.id)}
                      size="sm"
                      variant="secondary"
                      disabled={isLoadingDetails}
                    >
                      {isLoadingDetails ? "..." : "Details"}
                    </Button>
                    {visit.entry_time && !visit.exit_time && (
                      <Button onClick={() => handleCheckout(visit.id)} size="sm">
                        Check Out
                      </Button>
                    )}
                    {visit.status === "pending" && (
                      <Button onClick={() => handleCancel(visit.id)} size="sm" variant="danger">
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </main>

      {/* Visit Details Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold text-gray-900">Visit Details</h2>
              <button
                onClick={() => setSelectedVisit(null)}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Photo + Name */}
              <div className="flex items-center gap-4">
                <img
                  src={selectedVisit.photo_snapshot_url}
                  alt={selectedVisit.name_snapshot}
                  className="h-20 w-20 rounded-full border-2 border-gray-200 object-cover"
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedVisit.name_snapshot}</h3>
                  <StatusBadge status={selectedVisit.status} />
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <DetailRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={selectedVisit.phone_snapshot || "N/A"}
                />
                <DetailRow
                  icon={<User className="h-4 w-4" />}
                  label="Purpose"
                  value={selectedVisit.purpose}
                />
                <DetailRow
                  icon={<User className="h-4 w-4" />}
                  label="Flat"
                  value={selectedVisit.target_flat_ids?.join(", ") || selectedVisit.owner_id}
                />
                <DetailRow
                  icon={<Shield className="h-4 w-4" />}
                  label="Guard"
                  value={selectedVisit.guard_name || "Unknown"}
                />
                <DetailRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Entry"
                  value={
                    selectedVisit.entry_time ? formatTime(selectedVisit.entry_time) : "Not yet"
                  }
                />
                {selectedVisit.exit_time && (
                  <DetailRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Exit"
                    value={formatTime(selectedVisit.exit_time)}
                  />
                )}
                {selectedVisit.id_type && (
                  <DetailRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label={selectedVisit.id_type === "aadhar" ? "Aadhar No." : "PAN No."}
                    value={selectedVisit.id_number || "N/A"}
                  />
                )}
              </div>
            </div>

            <div className="border-t p-4">
              <Button onClick={() => setSelectedVisit(null)} className="w-full" variant="secondary">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400">{icon}</span>
      <span className="w-20 text-sm text-gray-500">{label}</span>
      <span className="flex-1 text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

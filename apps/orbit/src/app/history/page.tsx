/**
 * History Page
 * Displays today's visits with search and filter capabilities
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { StatusBadge } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { Card } from "@sm-visitor/ui";
import { visitsAPI } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import toast from "react-hot-toast";
import { ArrowLeft, Search } from "lucide-react";

interface Visit {
  _id: string;
  visitor_id?: string;
  name_snapshot: string;
  phone_snapshot?: string;
  photo_snapshot_url: string;
  purpose: string;
  owner_id: string;
  guard_id: string;
  entry_time?: string;
  exit_time?: string;
  status: "pending" | "approved" | "rejected" | "auto_approved";
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    filterVisits();
  }, [visits, searchQuery, statusFilter]);

  const fetchVisits = async () => {
    try {
      const response = await visitsAPI.getTodayVisits();
      setVisits(response);
    } catch (error: any) {
      console.error("Failed to fetch visits:", error);
      toast.error("Failed to load visits");
    } finally {
      setIsLoading(false);
    }
  };

  const filterVisits = () => {
    let filtered = [...visits];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((v) =>
        v.name_snapshot.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    setFilteredVisits(filtered);
  };

  const handleCheckout = async (visitId: string) => {
    try {
      await visitsAPI.checkout(visitId);
      toast.success("Visitor checked out successfully!");
      fetchVisits(); // Refresh list
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.response?.data?.detail || "Failed to checkout visitor");
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-gray-900">Today's Log</h1>
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
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="auto_approved">Auto Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Total Visits</p>
            <p className="text-2xl font-bold text-gray-900">{visits.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {visits.filter((v) => v.status === "pending").length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">
              {visits.filter((v) => v.status === "approved" || v.status === "auto_approved").length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Active Now</p>
            <p className="text-2xl font-bold text-blue-600">
              {visits.filter((v) => v.entry_time && !v.exit_time).length}
            </p>
          </Card>
        </div>

        {/* Visits List */}
        {filteredVisits.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">
              {searchQuery || statusFilter !== "all"
                ? "No visits match your filters"
                : "No visits recorded today"}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVisits.map((visit) => (
              <Card key={visit._id} className="p-4 hover:shadow-md">
                <div className="flex items-center gap-4">
                  {/* Photo */}
                  <img
                    src={visit.photo_snapshot_url}
                    alt={visit.name_snapshot}
                    className="h-16 w-16 rounded-full border-2 border-gray-200 object-cover"
                  />

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{visit.name_snapshot}</h3>
                        {visit.phone_snapshot && (
                          <p className="text-sm text-gray-600">{visit.phone_snapshot}</p>
                        )}
                        <p className="text-sm text-gray-600">{visit.purpose}</p>
                      </div>
                      <StatusBadge status={visit.status} />
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>Entry: {visit.entry_time ? formatTime(visit.entry_time) : "N/A"}</span>
                      {visit.exit_time && <span>Exit: {formatTime(visit.exit_time)}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  {visit.entry_time && !visit.exit_time && (
                    <Button onClick={() => handleCheckout(visit._id)} size="sm">
                      Check Out
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

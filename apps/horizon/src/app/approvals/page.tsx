/**
 * Pending Approvals Page
 * List and manage pending visit requests
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { visitsAPI } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { formatTime } from "@/lib/utils";
import toast from "react-hot-toast";
import { ArrowLeft, Check, X } from "lucide-react";

export default function ApprovalsPage() {
  const router = useRouter();
  const { pendingVisits, setPendingVisits, removePendingVisit } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadPendingVisits();
  }, []);

  const loadPendingVisits = async () => {
    try {
      const visits = await visitsAPI.getPending();
      setPendingVisits(visits);
    } catch (error: any) {
      console.error("Failed to load pending visits:", error);
      toast.error("Failed to load pending visits");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (visitId: string) => {
    setProcessingId(visitId);
    try {
      await visitsAPI.approve(visitId);
      toast.success("Visit approved!");
      removePendingVisit(visitId);
    } catch (error: any) {
      console.error("Approval error:", error);
      toast.error(error.response?.data?.detail || "Failed to approve visit");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (visitId: string) => {
    setProcessingId(visitId);
    try {
      await visitsAPI.reject(visitId, rejectReason || undefined);
      toast.success("Visit rejected");
      removePendingVisit(visitId);
      setRejectingId(null);
      setRejectReason("");
    } catch (error: any) {
      console.error("Rejection error:", error);
      toast.error(error.response?.data?.detail || "Failed to reject visit");
    } finally {
      setProcessingId(null);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-purple-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-gray-900">
                Pending Approvals ({pendingVisits.length})
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {pendingVisits.length === 0 ? (
          <Card className="bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">All caught up!</h2>
            <p className="mt-2 text-gray-600">No pending approvals at the moment.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {pendingVisits.map((visit) => (
              <Card key={visit._id} className="bg-white">
                <div className="p-6">
                  <div className="flex flex-col gap-6 md:flex-row">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                      <img
                        src={visit.photo_snapshot_url}
                        alt={visit.name_snapshot}
                        className="h-32 w-32 rounded-lg border-4 border-purple-100 object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{visit.name_snapshot}</h3>
                      {visit.phone_snapshot && (
                        <p className="mt-1 text-gray-600">{visit.phone_snapshot}</p>
                      )}

                      <div className="mt-4 space-y-2">
                        <div>
                          <span className="text-sm font-medium text-gray-600">Purpose:</span>
                          <p className="text-gray-900">{visit.purpose}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-600">Requested:</span>
                          <p className="text-gray-900">{formatTime(visit.created_at)}</p>
                        </div>
                      </div>

                      {/* Reject Modal */}
                      {rejectingId === visit._id && (
                        <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Rejection Reason (Optional)
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter reason for rejection..."
                            className="w-full rounded-lg border border-gray-300 p-2 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                            rows={3}
                          />
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReject(visit._id)}
                              isLoading={processingId === visit._id}
                            >
                              Confirm Rejection
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {rejectingId !== visit._id && (
                        <div className="mt-6 flex gap-3">
                          <Button
                            variant="danger"
                            onClick={() => setRejectingId(visit._id)}
                            disabled={processingId === visit._id}
                            className="flex-1"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            onClick={() => handleApprove(visit._id)}
                            isLoading={processingId === visit._id}
                            className="flex-1"
                            size="lg"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

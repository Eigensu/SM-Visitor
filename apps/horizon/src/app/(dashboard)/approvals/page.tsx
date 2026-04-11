"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { VisitorCard } from "@/components/shared/VisitorCard";
import { SSEIndicator } from "@/components/shared/SSEIndicator";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button, Spinner } from "@sm-visitor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, XCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { visitsAPI, visitorsAPI } from "@/lib/api";
import { useStore } from "@/lib/store";

export default function Approvals() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [regularRequests, setRegularRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const { pendingVisits, removePendingVisit } = useStore();

  // Fetch pending visits and regular requests on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [pending, pendingReg] = await Promise.all([
          visitsAPI.getPending(),
          visitorsAPI.getPendingRegular(),
        ]);
        setVisitors(pending);
        setRegularRequests(pendingReg);
      } catch (error) {
        console.error("Failed to fetch approvals:", error);
        toast.error("Failed to load approval requests");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Sync with SSE updates from store
  useEffect(() => {
    if (pendingVisits.length > 0) {
      setVisitors((prev) => {
        const newVisits = pendingVisits.filter((pv) => !prev.find((v) => v.id === pv.id));
        return [...newVisits, ...prev];
      });
    }
  }, [pendingVisits]);

  const handleApprove = async (id: string, isRegular: boolean = false) => {
    try {
      if (isRegular) {
        await visitorsAPI.approveRegular(id);
        setRegularRequests((prev) => prev.filter((v) => (v.id || v._id) !== id));
        toast.success("Regular visitor approved and activated!");
      } else {
        await visitsAPI.approve(id);
        setVisitors((prev) => prev.filter((v) => v.id !== id));
        removePendingVisit(id);
        toast.success("Visitor approved! Gate notified.");
      }
    } catch (error: any) {
      console.error("Failed to approve:", error);
      toast.error(error.response?.data?.detail || "Failed to approve request");
    }
  };

  const handleReject = async (id: string, isRegular: boolean = false) => {
    try {
      if (isRegular) {
        await visitorsAPI.rejectRegular(id);
        setRegularRequests((prev) => prev.filter((v) => (v.id || v._id) !== id));
        toast.error("Registration request rejected");
      } else {
        await visitsAPI.reject(id);
        setVisitors((prev) => prev.filter((v) => v.id !== id));
        removePendingVisit(id);
        toast.error("Visit rejected");
      }
    } catch (error: any) {
      console.error("Failed to reject:", error);
      toast.error(error.response?.data?.detail || "Failed to reject request");
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    if (activeTab === "all") return true;
    if (activeTab === "regular") return false; // Handled separately
    return v.status === activeTab;
  });

  const pendingCount = visitors.filter((v) => v.status === "pending").length;
  const approvedCount = visitors.filter((v) => v.status === "approved").length;
  const rejectedCount = visitors.filter((v) => v.status === "rejected").length;

  return (
    <PageContainer
      title="Real-time Approvals"
      description="Manage visitor entry and staff registration requests"
      action={<SSEIndicator connected={true} />}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <GlassCard className="py-4 text-center">
              <div className="mb-1 flex items-center justify-center gap-2 text-pending">
                <Clock className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-2xl font-semibold">{pendingCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </GlassCard>
            <GlassCard className="py-4 text-center">
              <div className="mb-1 flex items-center justify-center gap-2 text-blue-500">
                <Filter className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-2xl font-semibold">{regularRequests.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Regular Req</p>
            </GlassCard>
            <GlassCard className="py-4 text-center">
              <div className="mb-1 flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-2xl font-semibold">{approvedCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Approved</p>
            </GlassCard>
            <GlassCard className="py-4 text-center">
              <div className="mb-1 flex items-center justify-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-2xl font-semibold">{rejectedCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </GlassCard>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mb-4 flex items-center justify-between gap-4">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="pending" className="data-[state=active]:bg-card">
                  Pending
                </TabsTrigger>
                <TabsTrigger value="regular" className="data-[state=active]:bg-card">
                  Regular Staff
                </TabsTrigger>
                <TabsTrigger value="approved" className="data-[state=active]:bg-card">
                  Approved
                </TabsTrigger>
                <TabsTrigger value="rejected" className="data-[state=active]:bg-card">
                  Rejected
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {activeTab === "regular" ? (
                    regularRequests.length > 0 ? (
                      regularRequests.map((req) => (
                        <VisitorCard
                          key={req._id || req.id}
                          visitor={{
                            id: req._id || req.id,
                            name: req.name,
                            phone: req.phone || "N/A",
                            purpose: `Staff Role: ${req.category_label || req.category || "Staff"}`,
                            status: "pending", // Pro-forma for approval card
                            timestamp: new Date(req.created_at).toLocaleDateString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            }),
                            photo: req.photo_url,
                          }}
                          showActions={true}
                          onApprove={() => handleApprove(req._id || req.id, true)}
                          onReject={() => handleReject(req._id || req.id, true)}
                        />
                      ))
                    ) : (
                      <GlassCard className="py-12 text-center text-muted-foreground">
                        No pending staff registrations
                      </GlassCard>
                    )
                  ) : filteredVisitors.length > 0 ? (
                    filteredVisitors.map((visitor) => (
                      <VisitorCard
                        key={visitor.id}
                        visitor={{
                          id: visitor.id,
                          name: visitor.name_snapshot,
                          phone: visitor.phone_snapshot || "N/A",
                          purpose: visitor.purpose,
                          status: visitor.status,
                          timestamp: new Date(
                            visitor.created_at.endsWith("Z")
                              ? visitor.created_at
                              : visitor.created_at + "Z"
                          ).toLocaleDateString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "numeric",
                            month: "short",
                          }),
                          photo: visitor.photo_snapshot_url,
                        }}
                        showActions={visitor.status === "pending"}
                        onApprove={() => handleApprove(visitor.id, false)}
                        onReject={() => handleReject(visitor.id, false)}
                      />
                    ))
                  ) : (
                    <GlassCard className="py-12 text-center">
                      <p className="text-muted-foreground">No {activeTab} visitors</p>
                    </GlassCard>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}

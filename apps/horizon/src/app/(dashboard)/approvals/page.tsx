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
import { visitsAPI } from "@/lib/api";
import { useStore } from "@/lib/store";

export default function Approvals() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const { pendingVisits, removePendingVisit } = useStore();

  // Fetch pending visits on mount
  useEffect(() => {
    const fetchPending = async () => {
      try {
        setIsLoading(true);
        const pending = await visitsAPI.getPending();
        setVisitors(pending);
      } catch (error) {
        console.error("Failed to fetch pending visits:", error);
        toast.error("Failed to load visitor requests");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPending();
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

  const handleApprove = async (id: string) => {
    try {
      await visitsAPI.approve(id);

      // Remove from local state
      setVisitors((prev) => prev.filter((v) => v.id !== id));
      removePendingVisit(id);

      toast.success("Visitor approved! Gate notified.", {
        description: "The security gate has been informed.",
      });
    } catch (error: any) {
      console.error("Failed to approve visitor:", error);
      toast.error(error.response?.data?.detail || "Failed to approve visitor");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await visitsAPI.reject(id);

      // Remove from local state
      setVisitors((prev) => prev.filter((v) => v.id !== id));
      removePendingVisit(id);

      toast.error("Visitor rejected", {
        description: "The visitor has been denied entry.",
      });
    } catch (error: any) {
      console.error("Failed to reject visitor:", error);
      toast.error(error.response?.data?.detail || "Failed to reject visitor");
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    if (activeTab === "all") return true;
    return v.status === activeTab;
  });

  const pendingCount = visitors.filter((v) => v.status === "pending").length;
  const approvedCount = visitors.filter((v) => v.status === "approved").length;
  const rejectedCount = visitors.filter((v) => v.status === "rejected").length;

  return (
    <PageContainer
      title="Real-time Approvals"
      description="Manage visitor entry requests in real-time"
      action={<SSEIndicator connected={true} />}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <GlassCard className="py-4 text-center">
              <div className="mb-1 flex items-center justify-center gap-2 text-pending">
                <Clock className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-2xl font-semibold">{pendingCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
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
                <TabsTrigger value="approved" className="data-[state=active]:bg-card">
                  Approved
                </TabsTrigger>
                <TabsTrigger value="rejected" className="data-[state=active]:bg-card">
                  Rejected
                </TabsTrigger>
                <TabsTrigger value="all" className="data-[state=active]:bg-card">
                  All
                </TabsTrigger>
              </TabsList>
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Filter className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Filter
              </Button>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredVisitors.length > 0 ? (
                    filteredVisitors.map((visitor) => (
                      <VisitorCard
                        key={visitor.id}
                        visitor={{
                          id: visitor.id,
                          name: visitor.name_snapshot,
                          phone: visitor.phone_snapshot || "N/A",
                          purpose: visitor.purpose,
                          // flatNumber omitted as it's redundant for the owner
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
                        onApprove={() => handleApprove(visitor.id)}
                        onReject={() => handleReject(visitor.id)}
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

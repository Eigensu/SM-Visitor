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
import DebugOverlay from "@/components/DebugOverlay";

export default function Approvals() {
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const { pendingVisits, removePendingVisit, refreshMap } = useStore();

  // Helper to unify visitor data for the card component
  const unifyItem = (item: any) => {
    const isRegular = item.visitor_type === "regular";
    return {
      id: item.id || item._id,
      name: isRegular ? item.name : item.name_snapshot,
      phone: (isRegular ? item.phone : item.phone_snapshot) || "N/A",
      purpose: isRegular
        ? `Staff Registration: ${item.category_label || item.category || "Staff"}`
        : item.purpose,
      status: isRegular ? item.approval_status : item.status,
      timestamp: item.created_at,
      photo: isRegular ? item.photo_url : item.photo_snapshot_url,
      isRegular,
      qr_validity_hours: isRegular ? item.qr_validity_hours : undefined,
    };
  };

  // Fetch all data
  useEffect(() => {
    const fetchData = async (signal?: AbortSignal) => {
      try {
        setIsLoading(true);
        const [pVisits, pRegular, hVisits, hRegular] = await Promise.all([
          visitsAPI.getPending(signal),
          visitorsAPI.getPendingRegular(signal),
          visitsAPI.getHistory(signal),
          visitorsAPI.getHistoryRegular(signal),
        ]);

        // Merge and unify
        const mergedPending = [
          ...pVisits.map((v: any) => ({ ...v, visitor_type: "adhoc" })),
          ...pRegular.map((r: any) => ({ ...r, visitor_type: "regular" })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const mergedCompleted = [
          ...hVisits.map((v: any) => ({ ...v, visitor_type: "adhoc" })),
          ...hRegular.map((r: any) => ({ ...r, visitor_type: "regular" })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setPendingItems(mergedPending);
        setCompletedItems(mergedCompleted);
      } catch (error: any) {
        if (error.name === "AbortError" || error.message?.includes("canceled")) return;
        console.error("Failed to fetch approvals:", error);
        toast.error("Failed to load requests");
      } finally {
        setIsLoading(false);
      }
    };

    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [refreshMap.approvals]);

  // Sync with SSE updates
  useEffect(() => {
    if (pendingVisits.length > 0) {
      setPendingItems((prev) => {
        const newVisits = pendingVisits
          .filter((pv) => !prev.find((v) => (v.id || v._id) === pv.id))
          .map((v) => ({ ...v, visitor_type: "adhoc" }));
        return [...newVisits, ...prev];
      });
    }
  }, [pendingVisits]);

  const handleApprove = async (id: string, isRegular: boolean) => {
    try {
      if (isRegular) {
        await visitorsAPI.approveRegular(id);
        toast.success("Staff member approved!");
      } else {
        await visitsAPI.approve(id);
        removePendingVisit(id);
        toast.success("Visit approved!");
      }
      // Force refresh data
      const currentPending = pendingItems.find((i) => (i.id || i._id) === id);
      if (currentPending) {
        setPendingItems((prev) => prev.filter((i) => (i.id || i._id) !== id));
        setCompletedItems((prev) => [
          { ...currentPending, status: "approved", approval_status: "approved" },
          ...prev,
        ]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to approve");
    }
  };

  const handleReject = async (id: string, isRegular: boolean) => {
    try {
      if (isRegular) {
        await visitorsAPI.rejectRegular(id);
        toast.error("Staff request rejected");
      } else {
        await visitsAPI.reject(id);
        removePendingVisit(id);
        toast.error("Visit rejected");
      }
      // Move to completed locally
      const currentPending = pendingItems.find((i) => (i.id || i._id) === id);
      if (currentPending) {
        setPendingItems((prev) => prev.filter((i) => (i.id || i._id) !== id));
        setCompletedItems((prev) => [
          { ...currentPending, status: "rejected", approval_status: "rejected" },
          ...prev,
        ]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to reject");
    }
  };

  return (
    <PageContainer
      title="Approvals Hub"
      description="Manage visitor entry and staff registration requests"
      action={<SSEIndicator connected={true} />}
    >
      {process.env.NODE_ENV !== "production" && <DebugOverlay refreshMap={refreshMap} />}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <GlassCard className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Pending Tasks
                </p>
                <h3 className="mt-1 text-3xl font-bold text-pending">{pendingItems.length}</h3>
              </div>
              <div className="rounded-2xl bg-pending/10 p-4">
                <Clock className="h-8 w-8 text-pending" />
              </div>
            </GlassCard>
            <GlassCard className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Completed
                </p>
                <h3 className="mt-1 text-3xl font-bold text-success">{completedItems.length}</h3>
              </div>
              <div className="rounded-2xl bg-success/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </GlassCard>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-8 grid w-full grid-cols-2 rounded-xl bg-muted/30 p-1">
              <TabsTrigger
                value="pending"
                className="rounded-lg py-3 text-base font-semibold transition-all"
              >
                Pending Requests
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="rounded-lg py-3 text-base font-semibold transition-all"
              >
                History & Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-0 outline-none">
              <div className="space-y-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {pendingItems.length > 0 ? (
                    pendingItems.map((item) => {
                      const u = unifyItem(item);
                      return (
                        <VisitorCard
                          key={u.id}
                          visitor={u}
                          showActions={true}
                          onApprove={() => handleApprove(u.id, u.isRegular)}
                          onReject={() => handleReject(u.id, u.isRegular)}
                        />
                      );
                    })
                  ) : (
                    <GlassCard className="py-20 text-center">
                      <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-lg text-muted-foreground">
                        All caught up! No pending requests.
                      </p>
                    </GlassCard>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-0 outline-none">
              <div className="space-y-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {completedItems.length > 0 ? (
                    completedItems.map((item) => {
                      const u = unifyItem(item);
                      return <VisitorCard key={u.id} visitor={u} showActions={false} />;
                    })
                  ) : (
                    <GlassCard className="py-20 text-center">
                      <Filter className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-lg text-muted-foreground">No historical records found.</p>
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

"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { VisitorCard } from "@/components/shared/VisitorCard";
import { GlassCard } from "@/components/shared/GlassCard";
import { ShieldCheck, Users, Clock, AlertCircle } from "lucide-react";
import { Button, Spinner, Tabs, TabsList, TabsTrigger, TabsContent } from "@sm-visitor/ui";
import { visitsAPI, visitorsAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ApprovalsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);
  const [pendingStaff, setPendingStaff] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("ad-hoc");

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [visits, staff] = await Promise.all([
        visitsAPI.getPending(),
        visitorsAPI.getPendingRegular(),
      ]);
      setPendingVisits(visits);
      setPendingStaff(staff);
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveVisit = async (id: string) => {
    try {
      await visitsAPI.approve(id);
      toast.success("Visit approved successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve visit");
    }
  };

  const handleRejectVisit = async (id: string) => {
    try {
      await visitsAPI.reject(id);
      toast.success("Visit rejected");
      fetchData();
    } catch (error) {
      toast.error("Failed to reject visit");
    }
  };

  const handleApproveStaff = async (id: string) => {
    try {
      await visitorsAPI.approveRegular(id);
      toast.success("Staff member approved successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve staff member");
    }
  };

  const handleRejectStaff = async (id: string) => {
    try {
      await visitorsAPI.rejectRegular(id);
      toast.error("Staff registration rejected");
      fetchData();
    } catch (error) {
      toast.error("Failed to reject staff registration");
    }
  };

  return (
    <PageContainer
      title="Pending Approvals"
      description="Review and authorize entry requests or staff registrations"
    >
      <div className="space-y-6">
        <Tabs defaultValue="ad-hoc" className="w-full" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="ad-hoc" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Ad-hoc Visits ({pendingVisits.length})
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff Members ({pendingStaff.length})
              </TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="hidden sm:flex"
            >
              Refresh
            </Button>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <>
                <TabsContent value="ad-hoc" className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {pendingVisits.length > 0 ? (
                      pendingVisits.map((visit) => (
                        <VisitorCard
                          key={visit.id || visit._id}
                          visitor={{
                            id: visit.id || visit._id,
                            name: visit.name_snapshot,
                            phone: visit.phone_snapshot || "No phone",
                            purpose: visit.purpose,
                            status: "pending",
                            timestamp: new Date(visit.created_at).toLocaleString(),
                            photo: visit.photo_snapshot_url,
                          }}
                          showActions={true}
                          onApprove={() => handleApproveVisit(visit.id || visit._id)}
                          onReject={() => handleRejectVisit(visit.id || visit._id)}
                        />
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center"
                      >
                        <ShieldCheck className="mb-4 h-12 w-12 text-muted-foreground/20" />
                        <h3 className="text-lg font-medium">No pending visits</h3>
                        <p className="text-muted-foreground">
                          All gate requests have been processed.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="staff" className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {pendingStaff.length > 0 ? (
                      pendingStaff.map((staff) => (
                        <VisitorCard
                          key={staff.id || staff._id}
                          visitor={{
                            id: staff.id || staff._id,
                            name: staff.name,
                            phone: staff.phone || "No phone",
                            purpose: `Staff Registration (${staff.category || "Regular"})`,
                            status: "pending",
                            timestamp: new Date(staff.created_at).toLocaleString(),
                            photo: staff.photo_url,
                          }}
                          showActions={true}
                          onApprove={() => handleApproveStaff(staff.id || staff._id)}
                          onReject={() => handleRejectStaff(staff.id || staff._id)}
                        />
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center"
                      >
                        <Users className="mb-4 h-12 w-12 text-muted-foreground/20" />
                        <h3 className="text-lg font-medium">No pending staff</h3>
                        <p className="text-muted-foreground">
                          All staff registrations have been approved or rejected.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </PageContainer>
  );
}

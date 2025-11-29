"use client";

import { useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { VisitorCard } from "@/components/shared/VisitorCard";
import { SSEIndicator } from "@/components/shared/SSEIndicator";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@sm-visitor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, XCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";

const initialVisitors = [
  {
    id: "1",
    name: "Rahul Sharma",
    phone: "+91 98765 43210",
    purpose: "Delivery - Amazon",
    flatNumber: "A-401",
    status: "pending" as const,
    timestamp: "Just now",
  },
  {
    id: "2",
    name: "Meera Singh",
    phone: "+91 87654 32109",
    purpose: "Guest - Family Visit",
    flatNumber: "A-401",
    status: "pending" as const,
    timestamp: "5 min ago",
  },
  {
    id: "3",
    name: "Vikram Joshi",
    phone: "+91 76543 21098",
    purpose: "Electrician",
    flatNumber: "A-401",
    status: "pending" as const,
    timestamp: "12 min ago",
  },
  {
    id: "4",
    name: "Priya Patel",
    phone: "+91 65432 10987",
    purpose: "Guest - Friend",
    flatNumber: "A-401",
    status: "approved" as const,
    timestamp: "30 min ago",
  },
  {
    id: "5",
    name: "Unknown Caller",
    phone: "+91 54321 09876",
    purpose: "Not specified",
    flatNumber: "A-401",
    status: "rejected" as const,
    timestamp: "1 hour ago",
  },
];

export default function Approvals() {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [activeTab, setActiveTab] = useState("pending");

  const handleApprove = (id: string) => {
    setVisitors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: "approved" as const } : v))
    );
    toast.success("Visitor approved! Gate notified.", {
      description: "The security gate has been informed.",
    });
  };

  const handleReject = (id: string) => {
    setVisitors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: "rejected" as const } : v))
    );
    toast.error("Visitor rejected", {
      description: "The visitor has been denied entry.",
    });
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
                    visitor={visitor}
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
    </PageContainer>
  );
}

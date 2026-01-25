"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge, StatusType } from "@/components/shared/StatusBadge";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, User, MoreHorizontal, Calendar, Download, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface Visit {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  date: string;
  status: StatusType;
  photo?: string;
}

export default function Visitors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVisits = async () => {
    try {
      setIsLoading(true);
      const data = await visitsAPI.getHistory(100); // Fetch up to 100 recent visits

      // Transform API data to component format
      const transformedVisits: Visit[] = data.map((v: any) => ({
        id: v.id || v._id,
        name: v.name_snapshot,
        phone: v.phone_snapshot || "N/A",
        purpose: v.purpose,
        date: new Date(
          v.created_at.endsWith("Z") ? v.created_at : v.created_at + "Z"
        ).toLocaleDateString([], {
          hour: "2-digit",
          minute: "2-digit",
          day: "numeric",
          month: "short",
        }),
        status: v.status,
        photo: v.photo_snapshot_url,
      }));

      setVisits(transformedVisits);
    } catch (error) {
      console.error("Failed to fetch visits:", error);
      toast.error("Failed to load visitor history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const handleApprove = async (visitId: string) => {
    try {
      await visitsAPI.approve(visitId);
      toast.success("Visit approved successfully");
      fetchVisits(); // Refresh list
    } catch (error) {
      console.error("Failed to approve visit:", error);
      toast.error("Failed to approve visit");
    }
  };

  const handleReject = async (visitId: string) => {
    if (!confirm("Are you sure you want to reject this visitor?")) return;

    try {
      await visitsAPI.reject(visitId);
      toast.success("Visit rejected");
      fetchVisits(); // Refresh list
    } catch (error) {
      console.error("Failed to reject visit:", error);
      toast.error("Failed to reject visit");
    }
  };

  const filteredVisitors = visits.filter(
    (visitor) =>
      visitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.phone.includes(searchQuery)
  );

  return (
    <PageContainer
      title="Visitor Management"
      description="View and manage all visitor records"
      action={
        <Button className="ocean-gradient hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Pre-approve Visitor
        </Button>
      }
    >
      {/* Search & Filters */}
      <GlassCard className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background/50 pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Calendar className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <GlassCard className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold">Visitor</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Purpose</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                          {visitor.photo ? (
                            <img
                              src={visitor.photo}
                              alt={visitor.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
                          )}
                        </div>
                        <span className="font-medium">{visitor.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{visitor.phone}</TableCell>
                    <TableCell>{visitor.purpose}</TableCell>
                    <TableCell className="text-muted-foreground">{visitor.date}</TableCell>
                    <TableCell>
                      <StatusBadge status={visitor.status} />
                    </TableCell>
                    <TableCell>
                      {visitor.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleApprove(visitor.id)}
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleReject(visitor.id)}
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          {visitor.status !== "pending" && (
                            <DropdownMenuItem>Block Visitor</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {filteredVisitors.map((visitor) => (
              <GlassCard key={visitor.id} hover className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                      {visitor.photo ? (
                        <img
                          src={visitor.photo}
                          alt={visitor.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-primary" strokeWidth={1.5} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{visitor.name}</p>
                      <p className="text-sm text-muted-foreground">{visitor.phone}</p>
                    </div>
                  </div>
                  <StatusBadge status={visitor.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{visitor.purpose}</span>
                  <span className="text-muted-foreground">{visitor.date}</span>
                </div>

                {visitor.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      size="sm"
                      onClick={() => handleApprove(visitor.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:bg-red-50"
                      size="sm"
                      onClick={() => handleReject(visitor.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>

          {filteredVisitors.length === 0 && (
            <GlassCard className="py-12 text-center">
              <p className="text-muted-foreground">No visitors found matching your search</p>
            </GlassCard>
          )}
        </>
      )}
    </PageContainer>
  );
}

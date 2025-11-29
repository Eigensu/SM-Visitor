"use client";

import { useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge, StatusType } from "@/components/shared/StatusBadge";
import { Button } from "@sm-visitor/ui";
import { Input } from "@sm-visitor/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, User, MoreHorizontal, Calendar, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const visitorHistory = [
  {
    id: "1",
    name: "Rahul Sharma",
    phone: "+91 98765 43210",
    purpose: "Delivery - Amazon",
    date: "Today, 10:30 AM",
    status: "approved" as StatusType,
  },
  {
    id: "2",
    name: "Priya Patel",
    phone: "+91 87654 32109",
    purpose: "Guest - Family",
    date: "Today, 9:15 AM",
    status: "approved" as StatusType,
  },
  {
    id: "3",
    name: "Amit Kumar",
    phone: "+91 76543 21098",
    purpose: "Plumber",
    date: "Yesterday, 3:00 PM",
    status: "approved" as StatusType,
  },
  {
    id: "4",
    name: "Sneha Verma",
    phone: "+91 65432 10987",
    purpose: "Guest - Friend",
    date: "Yesterday, 11:00 AM",
    status: "rejected" as StatusType,
  },
  {
    id: "5",
    name: "Vikram Singh",
    phone: "+91 54321 09876",
    purpose: "Delivery - Swiggy",
    date: "2 days ago",
    status: "approved" as StatusType,
  },
  {
    id: "6",
    name: "Neha Gupta",
    phone: "+91 43210 98765",
    purpose: "House Help",
    date: "2 days ago",
    status: "approved" as StatusType,
  },
  {
    id: "7",
    name: "Rajesh Iyer",
    phone: "+91 32109 87654",
    purpose: "Electrician",
    date: "3 days ago",
    status: "approved" as StatusType,
  },
  {
    id: "8",
    name: "Unknown",
    phone: "+91 21098 76543",
    purpose: "Not specified",
    date: "4 days ago",
    status: "rejected" as StatusType,
  },
];

export default function Visitors() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVisitors = visitorHistory.filter(
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
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisitors.map((visitor) => (
              <TableRow key={visitor.id} className="border-border/50 hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Pre-approve Again</DropdownMenuItem>
                      <DropdownMenuItem>Block Visitor</DropdownMenuItem>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-5 w-5 text-primary" strokeWidth={1.5} />
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
          </GlassCard>
        ))}
      </div>

      {filteredVisitors.length === 0 && (
        <GlassCard className="py-12 text-center">
          <p className="text-muted-foreground">No visitors found matching your search</p>
        </GlassCard>
      )}
    </PageContainer>
  );
}

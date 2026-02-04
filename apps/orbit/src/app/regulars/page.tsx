"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { Search, User, Check, ArrowLeft, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { visitorsAPI, visitsAPI } from "@/lib/api";
import toast from "react-hot-toast";

const CATEGORY_ICONS: Record<string, string> = {
  maid: "🧹",
  cook: "👨‍🍳",
  driver: "🚗",
  delivery: "📦",
  milkman: "🥛",
  car_wash: "🧼",
  dog_walker: "🐕",
  cleaner: "✨",
  other: "📋",
};

export default function RegularsPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        setIsLoading(true);
        const data = await visitorsAPI.getAllVisitors(); // Need to ensure this exists for guards
        setVisitors(data);
      } catch (error) {
        console.error("Failed to fetch visitors:", error);
        toast.error("Failed to load regular visitors");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisitors();
  }, []);

  const handleStartVisit = async (visitor: any) => {
    setIsSubmitting(visitor._id);
    try {
      await visitsAPI.startVisit({
        qr_token: visitor.qr_token,
        owner_id: visitor.created_by,
        purpose: visitor.default_purpose || "Regular Entry",
      });
      toast.success(`Entry recorded for ${visitor.name}`);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Entry error:", error);
      toast.error(error.response?.data?.detail || "Failed to record entry");
    } finally {
      setIsSubmitting(null);
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.phone?.includes(searchQuery);
    const matchesCategory = selectedCategory === "all" || v.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="ml-4 text-xl font-bold text-foreground">Daily Staff / Regulars</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search & Filter */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="w-full rounded-lg border border-border bg-card py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "all" ? "primary" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
            >
              All
            </Button>
            {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
              <Button
                key={key}
                variant={selectedCategory === key ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(key)}
              >
                {icon} {key.replace("_", " ").toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No regular visitors found matching your criteria
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVisitors.map((visitor) => (
              <GlassCard key={visitor._id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <span className="text-2xl">{CATEGORY_ICONS[visitor.category] || "👤"}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="truncate font-semibold text-foreground">{visitor.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {visitor.category?.toUpperCase()} • {visitor.phone || "No phone"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => handleStartVisit(visitor)}
                    disabled={isSubmitting === visitor._id}
                  >
                    {isSubmitting === visitor._id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

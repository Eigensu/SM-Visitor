/**
 * Regular Visitors List Page
 * View and manage regular visitors
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { visitorsAPI } from "@/lib/api";
import { Button } from "@sm-visitor/ui";
import { Card } from "@sm-visitor/ui";
import { Spinner } from "@sm-visitor/ui";
import { Modal } from "@sm-visitor/ui";
import { QRDisplay } from "@/components/QRDisplay";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, QrCode, Edit, Trash2 } from "lucide-react";

export default function VisitorsPage() {
  const router = useRouter();
  const { regularVisitors, setRegularVisitors, removeRegularVisitor } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadVisitors();
  }, []);

  const loadVisitors = async () => {
    try {
      const visitors = await visitorsAPI.getRegular();
      setRegularVisitors(visitors);
    } catch (error: any) {
      console.error("Failed to load visitors:", error);
      toast.error("Failed to load visitors");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewQR = (visitor: any) => {
    setSelectedVisitor(visitor);
    setShowQRModal(true);
  };

  const handleDelete = async (visitorId: string) => {
    if (!confirm("Are you sure you want to delete this visitor? Their QR code will be revoked.")) {
      return;
    }

    setDeletingId(visitorId);
    try {
      await visitorsAPI.deleteRegular(visitorId);
      removeRegularVisitor(visitorId);
      toast.success("Visitor deleted successfully");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.response?.data?.detail || "Failed to delete visitor");
    } finally {
      setDeletingId(null);
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
                Regular Visitors ({regularVisitors.length})
              </h1>
            </div>
            <Button onClick={() => router.push("/visitors/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Visitor
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {regularVisitors.length === 0 ? (
          <Card className="bg-white p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900">No Regular Visitors</h2>
            <p className="mt-2 text-gray-600">Add your first regular visitor to get started.</p>
            <Button onClick={() => router.push("/visitors/new")} className="mt-6">
              <Plus className="mr-2 h-4 w-4" />
              Add Visitor
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {regularVisitors.map((visitor) => (
              <Card key={visitor._id} className="bg-white">
                <div className="p-6">
                  <div className="flex flex-col items-center">
                    <img
                      src={visitor.photo_url}
                      alt={visitor.name}
                      className="h-24 w-24 rounded-full border-4 border-purple-100 object-cover"
                    />
                    <h3 className="mt-4 text-lg font-bold text-gray-900">{visitor.name}</h3>
                    <p className="text-gray-600">{visitor.phone}</p>
                    <p className="mt-2 text-sm text-gray-600">{visitor.default_purpose}</p>
                  </div>

                  <div className="mt-6 flex gap-2">
                    <Button
                      onClick={() => handleViewQR(visitor)}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      View QR
                    </Button>
                    <Button
                      onClick={() => handleDelete(visitor._id)}
                      variant="danger"
                      size="sm"
                      isLoading={deletingId === visitor._id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* QR Modal */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title={`QR Code - ${selectedVisitor?.name}`}
        size="md"
      >
        {selectedVisitor && (
          <QRDisplay
            value={selectedVisitor.qr_token}
            name={selectedVisitor.name}
            details={{
              phone: selectedVisitor.phone,
              purpose: selectedVisitor.default_purpose,
              validUntil: "Permanent",
            }}
          />
        )}
      </Modal>
    </div>
  );
}

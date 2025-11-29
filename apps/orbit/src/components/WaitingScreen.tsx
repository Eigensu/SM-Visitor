/**
 * Waiting Screen Component
 * Shows waiting state while owner approves/rejects visit
 */
"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardBody } from "./ui/Card";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import { useStore } from "@/lib/store";

interface WaitingScreenProps {
  visit: {
    _id: string;
    name_snapshot: string;
    phone_snapshot?: string;
    photo_snapshot_url: string;
    purpose: string;
  };
  onApproved: () => void;
  onRejected: () => void;
  onTimeout: () => void;
  onCancel: () => void;
}

export function WaitingScreen({
  visit,
  onApproved,
  onRejected,
  onTimeout,
  onCancel,
}: WaitingScreenProps) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const { updateVisitStatus } = useStore();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll for visit status changes (backup to SSE)
    checkIntervalRef.current = setInterval(async () => {
      // In a real implementation, you might want to poll the API
      // For now, we rely on SSE
    }, 5000);

    return () => {
      clearInterval(timer);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardBody>
        <div className="space-y-6">
          {/* Animated Loading */}
          <div className="flex flex-col items-center py-8">
            <Spinner size="lg" />
            <p className="mt-4 text-lg font-medium text-gray-700">Waiting for owner approval...</p>
            <p className="mt-2 text-sm text-gray-500">Time remaining: {formatTime(timeLeft)}</p>
          </div>

          {/* Visitor Details */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Visitor Details</h3>
            <div className="space-y-2">
              {visit.photo_snapshot_url && (
                <div className="flex justify-center">
                  <img
                    src={visit.photo_snapshot_url}
                    alt={visit.name_snapshot}
                    className="h-24 w-24 rounded-full border-2 border-gray-300 object-cover"
                  />
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">Name:</span>
                <p className="font-medium text-gray-900">{visit.name_snapshot}</p>
              </div>
              {visit.phone_snapshot && (
                <div>
                  <span className="text-sm text-gray-600">Phone:</span>
                  <p className="font-medium text-gray-900">{visit.phone_snapshot}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">Purpose:</span>
                <p className="font-medium text-gray-900">{visit.purpose}</p>
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              The owner has been notified. You'll be alerted once they approve or reject this visit.
            </p>
          </div>

          {/* Cancel Button */}
          <Button variant="secondary" onClick={onCancel} className="w-full">
            Cancel Request
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

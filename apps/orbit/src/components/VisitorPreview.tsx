/**
 * Visitor Preview Component
 * Displays visitor details after successful QR scan
 */
"use client";

import { Button } from "@sm-visitor/ui";
import { Card, CardBody, CardFooter } from "@sm-visitor/ui";

interface VisitorData {
  visitor_id?: string;
  temp_qr_id?: string;
  name: string;
  phone?: string;
  photo_url?: string;
  purpose?: string;
  visitor_type: "regular" | "temporary";
  owner_id?: string;
  expires_at?: string;
}

interface VisitorPreviewProps {
  visitor: VisitorData;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function VisitorPreview({ visitor, onSubmit, onCancel, isLoading }: VisitorPreviewProps) {
  return (
    <Card>
      <CardBody>
        <div className="space-y-4">
          {/* Photo */}
          {visitor.photo_url && (
            <div className="flex justify-center">
              <img
                src={visitor.photo_url}
                alt={visitor.name}
                className="h-32 w-32 rounded-full border-4 border-blue-100 object-cover"
              />
            </div>
          )}

          {/* Visitor Details */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Name</label>
              <p className="text-lg font-semibold text-gray-900">{visitor.name}</p>
            </div>

            {visitor.phone && (
              <div>
                <label className="text-sm font-medium text-gray-600">Phone</label>
                <p className="text-lg text-gray-900">{visitor.phone}</p>
              </div>
            )}

            {visitor.purpose && (
              <div>
                <label className="text-sm font-medium text-gray-600">Purpose</label>
                <p className="text-lg text-gray-900">{visitor.purpose}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600">Type</label>
              <p className="text-lg text-gray-900">
                {visitor.visitor_type === "regular" ? "Regular Visitor" : "Temporary Guest"}
              </p>
            </div>

            {visitor.expires_at && (
              <div>
                <label className="text-sm font-medium text-gray-600">Valid Until</label>
                <p className="text-lg text-gray-900">
                  {new Date(visitor.expires_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Auto-approve indicator */}
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="ml-2 text-sm font-medium text-green-800">
                Auto-approved for entry
              </span>
            </div>
          </div>
        </div>
      </CardBody>

      <CardFooter>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={isLoading} className="flex-1" size="lg">
            Submit Entry
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

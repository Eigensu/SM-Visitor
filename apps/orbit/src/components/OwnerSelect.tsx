/**
 * Owner Select Component
 * Searchable dropdown for selecting property owner
 */
"use client";

import { useState, useEffect } from "react";
import { usersAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface Owner {
  id: string;
  name: string;
  flat_id?: string;
  phone: string;
}

interface OwnerSelectProps {
  value: string;
  onChange: (ownerId: string) => void;
  error?: string;
}

export function OwnerSelect({ value, onChange, error }: OwnerSelectProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const response = await usersAPI.getOwners();
        console.log("Fetched owners:", response); // Debug log
        setOwners(response);
      } catch (err: any) {
        console.error("Failed to fetch owners:", err);
        toast.error("Failed to load owners list");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOwners();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    console.log("Selected owner ID:", selectedId); // Debug log
    onChange(selectedId);
  };

  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Owner / Flat <span className="text-red-500">*</span>
      </label>
      <select
        value={value}
        onChange={handleChange}
        className={`w-full rounded-lg border px-4 py-2.5 text-base transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 ${
          error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        }`}
        disabled={isLoading}
      >
        <option key="placeholder" value="">
          {isLoading ? "Loading owners..." : "Select owner/flat"}
        </option>
        <option key="all" value="all" className="font-bold text-blue-600">
          🏢 All Flats (Broadcast Approval)
        </option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.flat_id || owner.id}>
            {owner.name} {owner.flat_id ? `(${owner.flat_id})` : ""}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

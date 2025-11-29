/**
 * Status Badge Component
 * Note: This component requires getStatusColor and getStatusLabel utilities
 * Apps should pass these as props or import from @sm-visitor/utils
 */

interface StatusBadgeProps {
  status: "pending" | "approved" | "rejected" | "auto_approved";
  getColor?: (status: string) => string;
  getLabel?: (status: string) => string;
}

// Default implementations
const defaultGetStatusColor = (status: string) => {
  const colors = {
    pending: "border-yellow-300 bg-yellow-50 text-yellow-800",
    approved: "border-green-300 bg-green-50 text-green-800",
    rejected: "border-red-300 bg-red-50 text-red-800",
    auto_approved: "border-blue-300 bg-blue-50 text-blue-800",
  };
  return colors[status as keyof typeof colors] || "border-gray-300 bg-gray-50 text-gray-800";
};

const defaultGetStatusLabel = (status: string) => {
  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    auto_approved: "Auto Approved",
  };
  return labels[status as keyof typeof labels] || status;
};

export function StatusBadge({
  status,
  getColor = defaultGetStatusColor,
  getLabel = defaultGetStatusLabel,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${getColor(
        status
      )}`}
    >
      {getLabel(status)}
    </span>
  );
}

/**
 * Reusable Card Component
 */
import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";

// Inline cn utility to avoid external dependencies
function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white shadow-sm",
        hoverable && "cursor-pointer transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-b border-gray-200 px-6 py-4", className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-gray-200 bg-gray-50 px-6 py-4", className)}>{children}</div>
  );
}

/**
 * Reusable Input Component
 */
import { InputHTMLAttributes, forwardRef } from "react";
import { clsx, type ClassValue } from "clsx";

// Inline cn utility to avoid external dependencies
function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1 block text-sm font-medium text-foreground">
            {label}
            {props.required && <span className="ml-1 text-destructive">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-lg border px-4 py-2.5 text-base transition-colors",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary",
            "disabled:cursor-not-allowed disabled:bg-muted",
            error ? "border-destructive focus:ring-destructive" : "border-border",
            className
          )}
          {...props}
          suppressHydrationWarning
        />
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

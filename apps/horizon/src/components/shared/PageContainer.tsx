import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function PageContainer({
  children,
  className,
  title,
  description,
  action,
}: PageContainerProps) {
  return (
    <div className={cn("smooth-scroll flex-1 overflow-auto p-4 md:p-6 lg:p-8", className)}>
      {(title || action) && (
        <div className="animate-fade-up mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="animate-fade-up delay-100">{children}</div>
    </div>
  );
}

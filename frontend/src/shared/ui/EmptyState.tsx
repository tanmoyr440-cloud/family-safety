import * as React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center",
          className,
        )}
        {...props}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4"
          aria-hidden="true"
        >
          {icon ?? <FolderOpen className="h-6 w-6" />}
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    );
  },
);

EmptyState.displayName = "EmptyState";

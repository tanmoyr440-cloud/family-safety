import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type StatusTone =
  "success" | "warning" | "danger" | "critical" | "info" | "neutral" | "paused";

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  label: string;
  icon?: React.ReactNode;
}

const TONE_STYLES: Record<
  StatusTone,
  { badge: string; iconColor: string; defaultIcon: React.ReactNode }
> = {
  success: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    defaultIcon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  warning: {
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
    defaultIcon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  danger: {
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    iconColor: "text-rose-600 dark:text-rose-400",
    defaultIcon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  critical: {
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    iconColor: "text-rose-600 dark:text-rose-400",
    defaultIcon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  info: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
    defaultIcon: <Info className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  paused: {
    badge:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    iconColor: "text-purple-600 dark:text-purple-400",
    defaultIcon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  neutral: {
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconColor: "text-slate-500 dark:text-slate-400",
    defaultIcon: <Info className="h-3.5 w-3.5" aria-hidden="true" />,
  },
};

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ tone, label, icon, className, ...props }, ref) => {
    const config = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
    const resolvedIcon = icon ?? config.defaultIcon;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
          config.badge,
          className,
        )}
        {...props}
      >
        <span className={config.iconColor} aria-hidden="true">
          {resolvedIcon}
        </span>
        <span>{label}</span>
      </span>
    );
  },
);

StatusPill.displayName = "StatusPill";

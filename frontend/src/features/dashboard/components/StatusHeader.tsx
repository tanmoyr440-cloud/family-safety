import * as React from "react";
import type { MonitorStatus } from "../api/useMonitorStatus";
import { StatusPill } from "@/shared/ui/StatusPill";
import { formatDateTimeIST, formatISTDate } from "@/shared/lib/dates";
import { Button } from "@/shared/ui/Button";
import { RotateCw } from "lucide-react";

export interface StatusHeaderProps {
  status: MonitorStatus;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function getStatusMessage(status: MonitorStatus): {
  headline: string;
  description: string;
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
} {
  switch (status.status) {
    case "OK":
      return {
        headline: "All good",
        description:
          status.days_idle === 0
            ? "You checked in today. Your 90-day inactivity clock is reset."
            : `Last activity recorded ${status.days_idle} ${status.days_idle === 1 ? "day" : "days"} ago. No safety alerts pending.`,
        tone: "success",
        label: "Healthy",
      };
    case "WARN_OWNER_1":
      return {
        headline: `It's been ${status.days_idle} days without activity`,
        description: "Please check in today so we don't worry your family.",
        tone: "warning",
        label: "Check-in Needed",
      };
    case "WARN_OWNER_2":
      return {
        headline: `Urgent: ${status.days_idle} days without activity`,
        description:
          "Stronger reminder sent to you. Emergency alerts will reach your family if you remain inactive.",
        tone: "warning",
        label: "Urgent Warning",
      };
    case "NOTIFY_PARENTS":
      return {
        headline: "Emergency alerts active",
        description:
          "90-day threshold reached. Your verified parents have been notified by SMS and email.",
        tone: "danger",
        label: "Family Notified",
      };
    case "PAUSED":
      return {
        headline: "Monitoring is paused",
        description: status.paused_until
          ? `Automatic checks and alerts are paused until ${formatISTDate(status.paused_until)}.`
          : "Automatic checks and alerts are currently paused.",
        tone: "neutral",
        label: "Paused",
      };
    default:
      return {
        headline: "Monitor active",
        description: `Days idle: ${status.days_idle} of ${status.threshold_days} days.`,
        tone: "neutral",
        label: status.status,
      };
  }
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  status,
  onRefresh,
  isRefreshing,
}) => {
  const info = getStatusMessage(status);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {info.headline}
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">{info.description}</p>
        {status.last_activity_at && (
          <p className="text-[11px] text-muted-foreground pt-0.5">
            Last recorded activity: {formatDateTimeIST(status.last_activity_at)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200 gap-1.5"
            aria-label="Refresh dashboard data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        )}
        <StatusPill tone={info.tone} label={info.label} />
      </div>
    </div>
  );
};

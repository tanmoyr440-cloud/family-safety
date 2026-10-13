import * as React from "react";
import type { MonitorStatus } from "../api/useMonitorStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { cn } from "@/shared/lib/utils";
import { Clock, ShieldAlert } from "lucide-react";

export interface InactivityRingProps {
  status: MonitorStatus;
  className?: string;
}

export const InactivityRing: React.FC<InactivityRingProps> = ({ status, className }) => {
  const threshold = status.threshold_days || 90;
  const daysIdle = Math.min(threshold, Math.max(0, status.days_idle));
  const percent = Math.min(100, Math.round((daysIdle / threshold) * 100));

  const warn1 = status.warning_days[0] ?? 60;
  const warn2 = status.warning_days[1] ?? 80;

  // Tone color based on current stage
  const ringColor =
    daysIdle >= threshold
      ? "text-red-500 stroke-red-500"
      : daysIdle >= warn2
        ? "text-orange-500 stroke-orange-500"
        : daysIdle >= warn1
          ? "text-amber-500 stroke-amber-500"
          : "text-blue-600 stroke-blue-600";

  // SVG circle math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Inactivity Timeline
          </span>
          <span className="text-xs font-normal text-slate-500">Threshold: {threshold} days</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        {/* Ring & Stats */}
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center sm:justify-start">
          <div className="relative flex items-center justify-center shrink-0">
            <svg
              className="w-36 h-36 -rotate-90 transform"
              viewBox="0 0 160 160"
              role="img"
              aria-label={`Inactivity progress: ${daysIdle} of ${threshold} days idle (${percent}%)`}
            >
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="12"
                fill="none"
              />
              {/* Filled Ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className={cn("transition-all duration-700 ease-out", ringColor)}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                {daysIdle}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Days Idle
              </span>
            </div>
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1">
            <div className="flex items-baseline justify-center sm:justify-start gap-1">
              <span className="text-lg font-bold text-slate-900">{threshold - daysIdle}</span>
              <span className="text-xs text-slate-500">days until emergency family alert</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
              Your 90-day clock resets whenever you tap &ldquo;I&apos;m okay&rdquo; or when activity
              is detected.
            </p>
          </div>
        </div>

        {/* Milestone Tick Markers */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Safety Net Milestones
          </h3>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-colors",
                daysIdle >= warn1
                  ? "bg-amber-50 text-amber-900 font-medium"
                  : "bg-slate-50 text-slate-600",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-2 w-2 rounded-full bg-amber-400"
                  aria-hidden="true"
                />
                <span>Day {warn1}: Friendly check-in reminder to you</span>
              </div>
              <span className="font-mono text-[11px]">
                {daysIdle >= warn1 ? "Triggered" : `in ${Math.max(0, warn1 - daysIdle)}d`}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-colors",
                daysIdle >= warn2
                  ? "bg-orange-50 text-orange-900 font-medium"
                  : "bg-slate-50 text-slate-600",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-2 w-2 rounded-full bg-orange-400"
                  aria-hidden="true"
                />
                <span>Day {warn2}: Urgent reminder to you</span>
              </div>
              <span className="font-mono text-[11px]">
                {daysIdle >= warn2 ? "Triggered" : `in ${Math.max(0, warn2 - daysIdle)}d`}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-colors",
                daysIdle >= threshold
                  ? "bg-red-50 text-red-900 font-medium"
                  : "bg-slate-50 text-slate-600",
              )}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" aria-hidden="true" />
                <span>Day {threshold}: Emergency alerts sent to Mom &amp; Dad</span>
              </div>
              <span className="font-mono text-[11px]">
                {daysIdle >= threshold ? "Active" : `in ${Math.max(0, threshold - daysIdle)}d`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

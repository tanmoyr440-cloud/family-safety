import * as React from "react";
import { useResumeMonitor } from "../api/useResumeMonitor";
import { formatISTDate } from "@/shared/lib/dates";
import { Button } from "@/shared/ui/Button";
import { PauseCircle, Play } from "lucide-react";

export interface PausedBannerProps {
  pausedUntil?: string | null;
}

export const PausedBanner: React.FC<PausedBannerProps> = ({ pausedUntil }) => {
  const { mutate: resume, isPending } = useResumeMonitor();

  return (
    <div
      role="region"
      aria-label="Monitoring paused banner"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-950"
    >
      <div className="flex items-start gap-3">
        <PauseCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold">Safety net monitoring is paused</h2>
          <p className="text-xs text-amber-900">
            {pausedUntil
              ? `Inactivity evaluation is suspended until ${formatISTDate(pausedUntil)}. No warning messages will be triggered.`
              : "Inactivity evaluation is temporarily suspended."}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => resume()}
        className="gap-1.5 border-amber-300 bg-white hover:bg-amber-50 text-amber-950 font-semibold shrink-0"
      >
        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        {isPending ? "Resuming..." : "Resume Monitoring Now"}
      </Button>
    </div>
  );
};

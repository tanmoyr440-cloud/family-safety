import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { pauseSchema, type PauseFormData, MAX_PAUSE_DAYS_CAP } from "../schemas/settingsSchemas";
import { usePauseMonitor } from "../api/usePauseMonitor";
import { useResumeMonitor } from "../api/useResumeMonitor";
import { AlertCircle, CheckCircle2, PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";

export interface PauseMonitoringCardProps {
  pausedUntil?: string | null;
}

export const PauseMonitoringCard: React.FC<PauseMonitoringCardProps> = ({ pausedUntil }) => {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Compute tomorrow and max allowed date string (YYYY-MM-DD)
  const tomorrowStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const maxDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_PAUSE_DAYS_CAP);
    return d.toISOString().slice(0, 10);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PauseFormData>({
    resolver: zodResolver(pauseSchema),
    defaultValues: {
      until: tomorrowStr,
    },
  });

  const { mutate: pause, isPending: isPausing } = usePauseMonitor();
  const { mutate: resume, isPending: isResuming } = useResumeMonitor();

  const handlePause = (data: PauseFormData) => {
    setSuccessMessage(null);
    setServerError(null);

    pause(
      { until: data.until },
      {
        onSuccess: () => {
          setSuccessMessage(`Monitoring paused until ${data.until}.`);
          reset();
        },
        onError: (err: Error) => {
          setServerError(err.message || "Failed to pause monitoring.");
        },
      },
    );
  };

  const handleResume = () => {
    setSuccessMessage(null);
    setServerError(null);

    resume(undefined, {
      onSuccess: () => {
        setSuccessMessage("Monitoring resumed successfully. Normal check-in schedule active.");
      },
      onError: (err: Error) => {
        setServerError(err.message || "Failed to resume monitoring.");
      },
    });
  };

  const isPaused = Boolean(pausedUntil);

  return (
    <Card className="border-border shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
            <PauseCircle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Pause Monitoring</CardTitle>
            <CardDescription className="text-xs">
              Temporarily halt countdown clocks and parent alerts (maximum {MAX_PAUSE_DAYS_CAP}{" "}
              days).
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {successMessage && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <p>{successMessage}</p>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
            <p>{serverError}</p>
          </div>
        )}

        {isPaused ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3 text-amber-950"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold">Monitoring is Currently Paused</p>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  Paused until <strong>{pausedUntil}</strong>. Alerts to your parents will not be
                  sent while paused.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResume}
              isLoading={isResuming}
              className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <PlayCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Resume Monitoring Now
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handlePause)} className="space-y-4">
            <div>
              <label
                htmlFor="pause_until"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Pause Until Date (Max {MAX_PAUSE_DAYS_CAP} days)
              </label>
              <input
                id="pause_until"
                type="date"
                min={tomorrowStr}
                max={maxDateStr}
                {...register("until")}
                aria-invalid={Boolean(errors.until)}
                aria-describedby={errors.until ? "pause_until-error" : undefined}
                className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Monitoring will automatically resume on this date, or whenever you check in.
              </p>
              {errors.until && (
                <p id="pause_until-error" className="mt-1 text-xs text-red-600">
                  {errors.until.message}
                </p>
              )}
            </div>

            <div>
              <Button type="submit" variant="outline" size="sm" isLoading={isPausing}>
                <PauseCircle className="h-4 w-4 mr-1.5 text-amber-600" aria-hidden="true" />
                Pause Inactivity Monitoring
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

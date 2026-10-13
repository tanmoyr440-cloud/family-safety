import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { thresholdsSchema, type ThresholdsFormData } from "../schemas/settingsSchemas";
import { useUpdateMonitorConfig } from "../api/useUpdateMonitorConfig";
import { AlertCircle, CheckCircle2, Sliders, ArrowRight } from "lucide-react";

export interface InactivityThresholdsCardProps {
  currentThresholdDays?: number;
  currentWarningDays?: number[];
  currentParentRepeatEveryDays?: number;
}

export const InactivityThresholdsCard: React.FC<InactivityThresholdsCardProps> = ({
  currentThresholdDays = 90,
  currentWarningDays = [60, 80],
  currentParentRepeatEveryDays = 7,
}) => {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ThresholdsFormData>({
    resolver: zodResolver(thresholdsSchema),
    mode: "onChange",
    defaultValues: {
      threshold_days: currentThresholdDays,
      warning_day_1: currentWarningDays[0] ?? 60,
      warning_day_2: currentWarningDays[1] ?? 80,
      parent_repeat_every_days: currentParentRepeatEveryDays,
    },
  });

  const { mutate: updateConfig, isPending } = useUpdateMonitorConfig();

  const watchedThreshold = watch("threshold_days");
  const watchedWarn1 = watch("warning_day_1");
  const watchedWarn2 = watch("warning_day_2");

  const onSubmit = (data: ThresholdsFormData) => {
    setSuccessMessage(null);
    setServerError(null);

    updateConfig(
      {
        threshold_days: data.threshold_days,
        warning_days: [data.warning_day_1, data.warning_day_2],
        parent_repeat_every_days: data.parent_repeat_every_days,
      },
      {
        onSuccess: () => {
          setSuccessMessage("Inactivity thresholds updated successfully.");
        },
        onError: (err: Error) => {
          setServerError(err.message || "Failed to update monitor thresholds.");
        },
      },
    );
  };

  return (
    <Card className="border-border shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Sliders className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Inactivity Alert Thresholds</CardTitle>
            <CardDescription className="text-xs">
              Configure how many days of inactivity trigger warnings and parent alerts.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Live Timeline Visualization */}
        <div
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
          aria-label="Inactivity timeline preview"
        >
          <span className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Timeline Preview
          </span>
          <div className="flex items-center justify-between text-xs font-medium text-slate-800">
            <div className="text-center">
              <span className="block font-bold text-slate-900 font-mono text-sm">
                Day {watchedWarn1 || "?"}
              </span>
              <span className="text-[11px] text-muted-foreground">First Reminder</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <div className="text-center">
              <span className="block font-bold text-amber-700 font-mono text-sm">
                Day {watchedWarn2 || "?"}
              </span>
              <span className="text-[11px] text-muted-foreground">Urgent Warning</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <div className="text-center">
              <span className="block font-bold text-red-700 font-mono text-sm">
                Day {watchedThreshold || "?"}
              </span>
              <span className="text-[11px] text-red-800 font-medium">Alert Parents</span>
            </div>
          </div>
        </div>

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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Warning Day 1 */}
            <div>
              <label
                htmlFor="warning_day_1"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Day 1 Warning
              </label>
              <input
                id="warning_day_1"
                type="number"
                {...register("warning_day_1", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.warning_day_1)}
                aria-describedby={errors.warning_day_1 ? "warning_day_1-error" : undefined}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.warning_day_1 && (
                <p id="warning_day_1-error" className="mt-1 text-xs text-red-600">
                  {errors.warning_day_1.message}
                </p>
              )}
            </div>

            {/* Warning Day 2 */}
            <div>
              <label
                htmlFor="warning_day_2"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Day 2 Warning
              </label>
              <input
                id="warning_day_2"
                type="number"
                {...register("warning_day_2", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.warning_day_2)}
                aria-describedby={errors.warning_day_2 ? "warning_day_2-error" : undefined}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.warning_day_2 && (
                <p id="warning_day_2-error" className="mt-1 text-xs text-red-600">
                  {errors.warning_day_2.message}
                </p>
              )}
            </div>

            {/* Final Threshold */}
            <div>
              <label
                htmlFor="threshold_days"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Alert Threshold (Days)
              </label>
              <input
                id="threshold_days"
                type="number"
                {...register("threshold_days", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.threshold_days)}
                aria-describedby={errors.threshold_days ? "threshold_days-error" : undefined}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.threshold_days && (
                <p id="threshold_days-error" className="mt-1 text-xs text-red-600">
                  {errors.threshold_days.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="parent_repeat_every_days"
              className="block text-xs font-semibold text-slate-800 mb-1"
            >
              Parent Follow-up Interval (Days)
            </label>
            <input
              id="parent_repeat_every_days"
              type="number"
              {...register("parent_repeat_every_days", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.parent_repeat_every_days)}
              aria-describedby={
                errors.parent_repeat_every_days ? "parent_repeat_every_days-error" : undefined
              }
              className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              How often reminder notifications repeat to parents after inactivity is reached.
            </p>
            {errors.parent_repeat_every_days && (
              <p id="parent_repeat_every_days-error" className="mt-1 text-xs text-red-600">
                {errors.parent_repeat_every_days.message}
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" size="sm" isLoading={isPending}>
              Save Thresholds
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

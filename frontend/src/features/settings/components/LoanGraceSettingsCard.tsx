import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { loanGraceSchema, type LoanGraceFormData } from "../schemas/settingsSchemas";
import { useUpdateLoanGrace } from "../api/useUpdateLoanGrace";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export interface LoanGraceSettingsCardProps {
  loanId?: string | null;
  currentGraceDays?: number;
  lenderName?: string | null;
}

export const LoanGraceSettingsCard: React.FC<LoanGraceSettingsCardProps> = ({
  loanId,
  currentGraceDays = 1,
  lenderName = "Vehicle Loan",
}) => {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoanGraceFormData>({
    resolver: zodResolver(loanGraceSchema),
    defaultValues: {
      grace_days: currentGraceDays,
    },
  });

  const { mutate: updateGrace, isPending } = useUpdateLoanGrace(loanId);

  const onSubmit = (data: LoanGraceFormData) => {
    setSuccessMessage(null);
    setServerError(null);

    updateGrace(data.grace_days, {
      onSuccess: () => {
        setSuccessMessage("Loan grace period updated successfully.");
      },
      onError: (err: Error) => {
        setServerError(err.message || "Failed to update loan grace days.");
      },
    });
  };

  return (
    <Card className="border-border shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Clock className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Loan Grace Period</CardTitle>
            <CardDescription className="text-xs">
              Extra days allowed before family is alerted for missed loan payments.
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

        {!loanId ? (
          <p className="text-xs text-muted-foreground">
            No active vehicle loan configured. Configure a loan under Loans to adjust grace days.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                htmlFor="grace_days"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Grace Days ({lenderName})
              </label>
              <input
                id="grace_days"
                type="number"
                {...register("grace_days", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.grace_days)}
                aria-describedby={errors.grace_days ? "grace_days-error" : undefined}
                className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                For example, with 1 grace day, if EMI is due on the 24th, family is only alerted if
                unpaid by the 26th.
              </p>
              {errors.grace_days && (
                <p id="grace_days-error" className="mt-1 text-xs text-red-600">
                  {errors.grace_days.message}
                </p>
              )}
            </div>

            <div>
              <Button type="submit" size="sm" isLoading={isPending}>
                Save Grace Days
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

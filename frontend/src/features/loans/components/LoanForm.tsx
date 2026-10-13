import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loanFormSchema, type LoanFormValues } from "../schemas/loanSchemas";
import type { Loan } from "../api/useLoans";
import { useCreateLoan } from "../api/useCreateLoan";
import { useUpdateLoan } from "../api/useUpdateLoan";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { AlertCircle, CreditCard, Info } from "lucide-react";
import { ApiError } from "@/shared/api/errors";

export interface LoanFormProps {
  loan?: Loan | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const LoanForm: React.FC<LoanFormProps> = ({ loan, onSuccess, onCancel, className }) => {
  const isEditing = Boolean(loan);
  const { mutate: createLoan, isPending: isCreatePending, error: createError } = useCreateLoan();
  const { mutate: updateLoan, isPending: isUpdatePending, error: updateError } = useUpdateLoan();
  const isPending = isCreatePending || isUpdatePending;
  const submitError = createError || updateError;

  const initialEmiRupees = loan ? Math.round(loan.emi_paise / 100) : ("" as unknown as number);
  const initialDueDay = loan ? loan.due_day : ("" as unknown as number);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      lender: loan?.lender || "",
      account_number: loan?.account_masked || "",
      emi_rupees: initialEmiRupees,
      due_day: initialDueDay,
      grace_days: loan?.grace_days ?? 1,
      upi_id: loan?.payment_instructions?.upi_id || "",
      portal_url: loan?.payment_instructions?.portal_url || "",
      notes: loan?.payment_instructions?.notes || "",
    },
  });

  const currentEmiRupees = watch("emi_rupees");
  const currentDueDay = watch("due_day");

  const hasTimingChanges =
    isEditing && (currentEmiRupees !== initialEmiRupees || currentDueDay !== initialDueDay);

  const onSubmit = (values: LoanFormValues) => {
    const emiPaise = Math.round(values.emi_rupees * 100);

    if (isEditing && loan) {
      updateLoan(
        {
          id: loan.id,
          data: {
            lender: values.lender,
            emi_paise: emiPaise,
            due_day: values.due_day,
            grace_days: values.grace_days,
            payment_instructions: {
              upi_id: values.upi_id || null,
              portal_url: values.portal_url || null,
              notes: values.notes || null,
            },
          },
        },
        {
          onSuccess: () => {
            onSuccess?.();
          },
          onError: (err) => {
            handleServerError(err);
          },
        },
      );
    } else {
      createLoan(
        {
          lender: values.lender,
          account_number: values.account_number,
          emi_paise: emiPaise,
          due_day: values.due_day,
          grace_days: values.grace_days,
          payment_instructions: {
            upi_id: values.upi_id || null,
            portal_url: values.portal_url || null,
            notes: values.notes || null,
          },
        },
        {
          onSuccess: () => {
            onSuccess?.();
          },
          onError: (err) => {
            handleServerError(err);
          },
        },
      );
    }
  };

  const handleServerError = (err: unknown) => {
    if (err instanceof ApiError && err.fieldErrors) {
      for (const item of err.fieldErrors) {
        if (item.field in loanFormSchema.shape) {
          setError(item.field as keyof LoanFormValues, {
            type: "server",
            message: item.message,
          });
        }
      }
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4 border-b border-slate-100">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-600" aria-hidden="true" />
          {isEditing ? "Edit Car Loan Obligation" : "Add Car Loan Obligation"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {submitError && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900 font-medium flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {submitError instanceof Error
                  ? submitError.message
                  : "An error occurred while saving loan details."}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lender */}
            <div className="space-y-1.5">
              <label htmlFor="loan-lender" className="block text-xs font-semibold text-slate-700">
                Lender / Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                id="loan-lender"
                type="text"
                placeholder="e.g. HDFC Bank, SBI, ICICI"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-invalid={Boolean(errors.lender)}
                aria-describedby={errors.lender ? "loan-lender-error" : undefined}
                {...register("lender")}
              />
              {errors.lender && (
                <p id="loan-lender-error" role="alert" className="text-xs text-red-600 font-medium">
                  {errors.lender.message}
                </p>
              )}
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
              <label htmlFor="loan-account" className="block text-xs font-semibold text-slate-700">
                Loan Account Number{" "}
                {isEditing ? "(Masked)" : <span className="text-red-500">*</span>}
              </label>
              <input
                id="loan-account"
                type="text"
                disabled={isEditing}
                placeholder="e.g. 16-digit account or loan ref"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                aria-invalid={Boolean(errors.account_number)}
                aria-describedby={errors.account_number ? "loan-account-error" : undefined}
                {...register("account_number")}
              />
              {errors.account_number && (
                <p
                  id="loan-account-error"
                  role="alert"
                  className="text-xs text-red-600 font-medium"
                >
                  {errors.account_number.message}
                </p>
              )}
            </div>

            {/* Monthly EMI (Rupees) */}
            <div className="space-y-1.5">
              <label htmlFor="loan-emi" className="block text-xs font-semibold text-slate-700">
                Monthly EMI (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="loan-emi"
                type="number"
                placeholder="e.g. 16166"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-invalid={Boolean(errors.emi_rupees)}
                aria-describedby={errors.emi_rupees ? "loan-emi-error" : undefined}
                {...register("emi_rupees", { valueAsNumber: true })}
              />
              {errors.emi_rupees && (
                <p id="loan-emi-error" role="alert" className="text-xs text-red-600 font-medium">
                  {errors.emi_rupees.message}
                </p>
              )}
            </div>

            {/* Due Day of Month */}
            <div className="space-y-1.5">
              <label htmlFor="loan-due-day" className="block text-xs font-semibold text-slate-700">
                Monthly Due Day (1 - 31) <span className="text-red-500">*</span>
              </label>
              <input
                id="loan-due-day"
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 24"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-invalid={Boolean(errors.due_day)}
                aria-describedby={errors.due_day ? "loan-due-day-error" : undefined}
                {...register("due_day", { valueAsNumber: true })}
              />
              {errors.due_day && (
                <p
                  id="loan-due-day-error"
                  role="alert"
                  className="text-xs text-red-600 font-medium"
                >
                  {errors.due_day.message}
                </p>
              )}
            </div>

            {/* Grace Days */}
            <div className="space-y-1.5">
              <label
                htmlFor="loan-grace-days"
                className="block text-xs font-semibold text-slate-700"
              >
                Grace Days (Default: 1)
              </label>
              <input
                id="loan-grace-days"
                type="number"
                min={0}
                placeholder="1"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-invalid={Boolean(errors.grace_days)}
                aria-describedby={errors.grace_days ? "loan-grace-days-error" : undefined}
                {...register("grace_days", { valueAsNumber: true })}
              />
              {errors.grace_days && (
                <p
                  id="loan-grace-days-error"
                  role="alert"
                  className="text-xs text-red-600 font-medium"
                >
                  {errors.grace_days.message}
                </p>
              )}
            </div>

            {/* Direct UPI ID */}
            <div className="space-y-1.5">
              <label htmlFor="loan-upi" className="block text-xs font-semibold text-slate-700">
                Direct Lender UPI ID <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="loan-upi"
                type="text"
                placeholder="e.g. carloan@hdfc"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-invalid={Boolean(errors.upi_id)}
                aria-describedby={errors.upi_id ? "loan-upi-error" : undefined}
                {...register("upi_id")}
              />
              {errors.upi_id && (
                <p id="loan-upi-error" role="alert" className="text-xs text-red-600 font-medium">
                  {errors.upi_id.message}
                </p>
              )}
            </div>
          </div>

          {/* Portal URL */}
          <div className="space-y-1.5">
            <label htmlFor="loan-portal" className="block text-xs font-semibold text-slate-700">
              Netbanking / Lender Portal URL{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="loan-portal"
              type="url"
              placeholder="https://netbanking.hdfcbank.com"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-invalid={Boolean(errors.portal_url)}
              aria-describedby={errors.portal_url ? "loan-portal-error" : undefined}
              {...register("portal_url")}
            />
            {errors.portal_url && (
              <p id="loan-portal-error" role="alert" className="text-xs text-red-600 font-medium">
                {errors.portal_url.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="loan-notes" className="block text-xs font-semibold text-slate-700">
              Payment Instructions / Nominee Notes{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="loan-notes"
              rows={3}
              placeholder="Payment instructions shared with parents if EMI is missed..."
              className="w-full p-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "loan-notes-error" : undefined}
              {...register("notes")}
            />
            {errors.notes && (
              <p id="loan-notes-error" role="alert" className="text-xs text-red-600 font-medium">
                {errors.notes.message}
              </p>
            )}
          </div>

          {/* Inline note when editing EMI or Due Day */}
          {hasTimingChanges && (
            <div
              role="note"
              className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900"
            >
              <Info className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <span>This applies from the next installment.</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
            {onCancel && (
              <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" isLoading={isPending}>
              {isEditing ? "Save Changes" : "Save Loan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

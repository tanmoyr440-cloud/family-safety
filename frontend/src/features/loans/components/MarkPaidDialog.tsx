import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMarkInstallmentPaid } from "../api/useMarkInstallmentPaid";
import { formatPaise } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  yearMonth: string;
  amountPaise: number;
  onSuccess?: () => void;
}

export const MarkPaidDialog: React.FC<MarkPaidDialogProps> = ({
  open,
  onOpenChange,
  loanId,
  yearMonth,
  amountPaise,
  onSuccess,
}) => {
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [isSuccessState, setIsSuccessState] = React.useState(false);

  const { mutate: markPaid, isPending, isError, error, reset } = useMarkInstallmentPaid();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setReference("");
      setNote("");
      setIsSuccessState(false);
      reset();
    }
  }, [open, reset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    markPaid(
      {
        loanId,
        yearMonth,
        reference: reference.trim() || null,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setIsSuccessState(true);
          onSuccess?.();
          timerRef.current = setTimeout(() => {
            onOpenChange(false);
          }, 1200);
        },
      },
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4",
            "border border-slate-200 bg-white p-6 shadow-xl duration-200 rounded-2xl",
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <DialogPrimitive.Title className="text-lg font-bold text-slate-900">
              Record EMI Payment
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="rounded-full p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="text-sm text-slate-600 leading-relaxed">
            Confirm your payment of{" "}
            <strong className="text-slate-900 font-semibold">{formatPaise(amountPaise)}</strong> for{" "}
            <span className="font-medium text-slate-900">{yearMonth}</span>. This updates your
            status and resolves any missed alert notifications for your family.
          </DialogPrimitive.Description>

          {isSuccessState ? (
            <div
              role="status"
              className="py-6 flex flex-col items-center justify-center space-y-2 text-center"
            >
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Payment Recorded</h4>
              <p className="text-xs text-slate-600">
                Your EMI installment timeline has been updated.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900 font-medium flex items-start gap-2"
                >
                  <AlertCircle
                    className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    {error instanceof Error
                      ? error.message
                      : "Failed to record payment. Please try again."}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="payment-reference"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Payment Reference / UTR{" "}
                  <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  id="payment-reference"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. UTR / UPI Ref / Transaction ID"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="payment-notes"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Payment Notes <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  id="payment-notes"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Paid via netbanking auto-debit"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isPending}>
                  Confirm Payment
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

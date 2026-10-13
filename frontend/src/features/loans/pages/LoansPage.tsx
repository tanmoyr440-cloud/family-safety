import * as React from "react";
import { useLoans } from "../api/useLoans";
import { useLoanInstallments, type Installment } from "../api/useLoanInstallments";
import { LoanDetailCard } from "../components/LoanDetailCard";
import { InstallmentTimeline } from "../components/InstallmentTimeline";
import { MissedInstallmentBanner } from "../components/MissedInstallmentBanner";
import { MarkPaidDialog } from "../components/MarkPaidDialog";
import { LoanForm } from "../components/LoanForm";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, CreditCard, Plus, RefreshCw } from "lucide-react";

export const LoansPage: React.FC = () => {
  const {
    data: loans,
    isLoading: isLoansLoading,
    isError: isLoansError,
    error: loansError,
    refetch: refetchLoans,
  } = useLoans();

  const primaryLoan = loans?.[0] ?? null;

  const { data: installments, isLoading: isInstallmentsLoading } = useLoanInstallments(
    primaryLoan?.id,
  );

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [activeInstallmentForPay, setActiveInstallmentForPay] = React.useState<Installment | null>(
    null,
  );

  if (isLoansLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading loans">
        <div className="border-b border-slate-200 pb-5">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <span className="sr-only">Loading loan and installment records...</span>
      </div>
    );
  }

  if (isLoansError || !loans) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 space-y-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-red-950">Unable to load loan details</h2>
            <p className="text-sm text-red-800">
              {loansError instanceof Error
                ? loansError.message
                : "A network error occurred while retrieving your loan records."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchLoans()}
          className="gap-2 bg-white border-red-200 text-red-900 hover:bg-red-100"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </Button>
      </div>
    );
  }

  // If no loan is configured yet
  if (!primaryLoan) {
    if (!isFormOpen) {
      return (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Car Loan Tracking
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Track your vehicle loan obligations and protect your credit score from missed
              payments.
            </p>
          </div>

          <EmptyState
            icon={<CreditCard className="h-7 w-7 text-blue-600" aria-hidden="true" />}
            title="No loan obligation configured"
            description="Register your monthly EMI details so we can remind you before the due date and notify your family if a payment goes undetected."
            action={
              <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Configure Car Loan
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Register Car Loan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter your vehicle EMI amount, lender name, and payment instructions.
          </p>
        </div>
        <LoanForm onCancel={() => setIsFormOpen(false)} onSuccess={() => setIsFormOpen(false)} />
      </div>
    );
  }

  // Edit form mode for existing loan
  if (isFormOpen) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Edit Loan Details
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Update your monthly EMI amount, payment instructions, or due day.
          </p>
        </div>
        <LoanForm
          loan={primaryLoan}
          onCancel={() => setIsFormOpen(false)}
          onSuccess={() => setIsFormOpen(false)}
        />
      </div>
    );
  }

  // Check if any installment is in MISSED state
  const missedInstallment =
    installments?.find((i) => i.status.toUpperCase() === "MISSED") ||
    (primaryLoan.next_due?.status.toUpperCase() === "MISSED"
      ? {
          year_month: primaryLoan.next_due.year_month,
          due_date: primaryLoan.next_due.due_date,
          amount_paise: primaryLoan.emi_paise,
          status: "MISSED",
          paid_at: null,
          evidence: null,
        }
      : null);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Car Loan Tracking
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Monitor your vehicle EMI obligations, verify payments, and keep emergency contacts
          reassured.
        </p>
      </div>

      {/* Missed installment alert banner */}
      {missedInstallment && (
        <MissedInstallmentBanner
          loan={primaryLoan}
          installment={missedInstallment}
          onPayLateClick={() => setActiveInstallmentForPay(missedInstallment)}
        />
      )}

      {/* Primary Loan Details Card */}
      <LoanDetailCard loan={primaryLoan} onEditClick={() => setIsFormOpen(true)} />

      {/* Installment History Timeline */}
      {isInstallmentsLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <InstallmentTimeline
          installments={installments || []}
          onMarkPaidClick={(inst) => setActiveInstallmentForPay(inst)}
        />
      )}

      {/* Mark Paid Dialog */}
      {activeInstallmentForPay && (
        <MarkPaidDialog
          open={Boolean(activeInstallmentForPay)}
          onOpenChange={(open) => {
            if (!open) setActiveInstallmentForPay(null);
          }}
          loanId={primaryLoan.id}
          yearMonth={activeInstallmentForPay.year_month}
          amountPaise={activeInstallmentForPay.amount_paise || primaryLoan.emi_paise}
        />
      )}
    </div>
  );
};

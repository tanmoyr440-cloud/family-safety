import * as React from "react";
import { Link } from "react-router-dom";
import type { Installment } from "../api/useLoanInstallments";
import type { Loan } from "../api/useLoans";
import { formatISTDate } from "@/shared/lib/dates";
import { formatPaise } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";

export interface MissedInstallmentBannerProps {
  loan: Loan;
  installment: Installment;
  onPayLateClick: () => void;
}

export const MissedInstallmentBanner: React.FC<MissedInstallmentBannerProps> = ({
  loan,
  installment,
  onPayLateClick,
}) => {
  return (
    <div
      role="alert"
      className="rounded-2xl border-2 border-red-300 bg-red-50/90 p-5 sm:p-6 text-red-950 space-y-4 shadow-sm"
    >
      <div className="flex items-start gap-3.5">
        <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-red-950">
            Missed Car Loan EMI Alert Sent to Family
          </h2>
          <p className="text-xs sm:text-sm text-red-900 leading-relaxed">
            Payment of <strong>{formatPaise(installment.amount_paise || loan.emi_paise)}</strong>{" "}
            for <strong>{installment.year_month}</strong> due on{" "}
            {formatISTDate(installment.due_date)} was not recorded before the grace window.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white/80 border border-red-200 p-3.5 text-xs text-red-900 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-red-950">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>What your family was told:</span>
        </div>
        <p className="text-slate-700 italic">
          &ldquo;We haven&apos;t detected your {loan.lender} car loan EMI payment of{" "}
          {formatPaise(installment.amount_paise || loan.emi_paise)} due on {installment.due_date}.
          Here are the account instructions to verify or pay to avoid lender penalty.&rdquo;
        </p>
        <div className="pt-1">
          <Link
            to="/notifications"
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 hover:underline"
          >
            <span>View alert details in notification log</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <p className="text-xs text-red-800">
          Already paid? Mark it below so we can notify your parents that the EMI obligation has been
          resolved.
        </p>
        <Button
          onClick={onPayLateClick}
          className="bg-red-700 hover:bg-red-800 text-white shrink-0 gap-2"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />I paid late
        </Button>
      </div>
    </div>
  );
};

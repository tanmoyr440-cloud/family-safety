import * as React from "react";
import { Link } from "react-router-dom";
import type { Loan } from "@/features/loans/api/useLoans";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { StatusPill, type StatusTone } from "@/shared/ui/StatusPill";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Button } from "@/shared/ui/Button";
import { formatRelativeDueDate } from "@/shared/lib/dates";
import { CreditCard, ExternalLink, IndianRupee } from "lucide-react";

export interface NextEmiCardProps {
  loan?: Loan | null;
  onPayClick?: () => void;
}

function getInstallmentTone(status: string): StatusTone {
  switch (status.toUpperCase()) {
    case "PAID":
      return "success";
    case "DUE":
      return "warning";
    case "MISSED":
      return "danger";
    case "UPCOMING":
    default:
      return "neutral";
  }
}

export const NextEmiCard: React.FC<NextEmiCardProps> = ({ loan, onPayClick }) => {
  if (!loan) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Car Loan EMI Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            No active loan configured. Add your monthly EMI obligation so we can alert your family
            if a payment is missed.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/loans">Configure Car Loan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const nextDue = loan.next_due;
  const status = nextDue?.status || "UPCOMING";
  const tone = getInstallmentTone(status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Next EMI Obligation
          </CardTitle>
          <StatusPill tone={tone} label={status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              <MoneyText paise={loan.emi_paise} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {loan.lender} • Account ending in {loan.account_masked}
            </p>
          </div>

          {nextDue && (
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold text-slate-700">Due Date</p>
              <p className="text-sm font-medium text-slate-900">
                {formatRelativeDueDate(nextDue.due_date)}
              </p>
            </div>
          )}
        </div>

        {status === "MISSED" && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900 font-medium space-y-1"
          >
            <p className="font-semibold text-red-950">Payment missed for this cycle</p>
            <p>
              Your emergency contacts have been notified with bank payment instructions. If you have
              made the payment, tap &ldquo;I paid&rdquo; below to update the status.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {status !== "PAID" && (
            <Button
              asChild
              variant={status === "MISSED" || status === "DUE" ? "default" : "outline"}
              size="sm"
              className="w-full sm:w-auto flex-1 sm:flex-none"
            >
              <Link to="/loans" onClick={onPayClick}>
                I paid this EMI
              </Link>
            </Button>
          )}

          {loan.payment_instructions?.portal_url && (
            <a
              href={loan.payment_instructions.portal_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline px-2 py-1"
            >
              <span>Netbanking portal</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

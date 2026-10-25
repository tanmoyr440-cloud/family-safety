import * as React from "react";
import { Link } from "react-router-dom";
import type { Loan } from "@/features/loans/api/useLoans";
import type { Installment } from "@/features/loans/api/useLoanInstallments";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { StatusPill, type StatusTone } from "@/shared/ui/StatusPill";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Button } from "@/shared/ui/Button";
import { formatRelativeDueDate, formatISTDate, formatISTShortDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import {
  CreditCard,
  ExternalLink,
  IndianRupee,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export interface NextEmiCardProps {
  loan?: Loan | null;
  installments?: Installment[];
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

export const NextEmiCard: React.FC<NextEmiCardProps> = ({
  loan,
  installments,
  onPayClick,
}) => {
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

  // Find if there is a recently paid installment
  const recentPaid = React.useMemo(() => {
    return installments?.find((i) => i.status.toUpperCase() === "PAID") || null;
  }, [installments]);

  // Derive timeline entries
  const timelineItems = React.useMemo(() => {
    const items = [...(installments || [])];
    if (nextDue && !items.some((i) => i.year_month === nextDue.year_month)) {
      items.push({
        year_month: nextDue.year_month,
        due_date: nextDue.due_date,
        amount_paise: loan.emi_paise,
        status: nextDue.status,
        paid_at: null,
      });
    }
    // Sort chronologically ascending
    const sorted = items.sort((a, b) => a.due_date.localeCompare(b.due_date));
    return sorted.slice(-3);
  }, [installments, nextDue, loan.emi_paise]);

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
              <p className="text-xs font-semibold text-slate-700">Next EMI Date</p>
              <p className="text-sm font-medium text-slate-900">
                {formatRelativeDueDate(nextDue.due_date)}
              </p>
            </div>
          )}
        </div>

        {recentPaid && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold text-emerald-950">
                {recentPaid.year_month} EMI Marked as Paid
                {recentPaid.paid_at ? ` on ${formatISTDate(recentPaid.paid_at)}` : ""}
              </p>
              <p className="text-emerald-800">
                Your payment was recorded. Next installment is due on{" "}
                {nextDue ? formatISTDate(nextDue.due_date) : "the upcoming scheduled date"}.
              </p>
            </div>
          </div>
        )}

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

        {/* Installment Cycle Timeline */}
        {timelineItems.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                EMI Timeline
              </span>
              <Link
                to="/loans"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="relative pl-5 space-y-2.5 pt-1 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timelineItems.map((item) => {
                const itemStatus = item.status.toUpperCase();
                const isPaid = itemStatus === "PAID";
                const isMissed = itemStatus === "MISSED";
                const isDue = itemStatus === "DUE";
                const itemTone = getInstallmentTone(item.status);

                return (
                  <div key={item.year_month} className="relative group">
                    <div
                      className={cn(
                        "absolute -left-[19px] top-1.5 h-3 w-3 rounded-full border-2 border-white ring-2",
                        isPaid
                          ? "bg-emerald-500 ring-emerald-200"
                          : isMissed
                            ? "bg-red-500 ring-red-200"
                            : isDue
                              ? "bg-amber-500 ring-amber-200"
                              : "bg-blue-500 ring-blue-200",
                      )}
                      aria-hidden="true"
                    />

                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {item.year_month}
                          </span>
                          <StatusPill tone={itemTone} label={item.status} />
                        </div>
                        <p className="text-xs text-slate-500">
                          {isPaid && item.paid_at
                            ? `Paid on ${formatISTShortDate(item.paid_at)}`
                            : `Due on ${formatISTDate(item.due_date)}`}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-900">
                          <MoneyText paise={item.amount_paise || loan.emi_paise} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

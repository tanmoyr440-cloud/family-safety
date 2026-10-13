import * as React from "react";
import type { Loan } from "../api/useLoans";
import { formatPaise } from "@/shared/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { CreditCard, Edit3, ExternalLink, QrCode, ShieldCheck } from "lucide-react";

export interface LoanDetailCardProps {
  loan: Loan;
  onEditClick: () => void;
  className?: string;
}

export const LoanDetailCard: React.FC<LoanDetailCardProps> = ({ loan, onEditClick, className }) => {
  return (
    <Card className={className}>
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Active Car Loan Obligation
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onEditClick}
          className="gap-1.5 text-xs font-semibold"
        >
          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          Edit Loan
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Lender
            </span>
            <p className="text-base font-bold text-slate-900">{loan.lender}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Account Number
            </span>
            <p className="text-base font-bold text-slate-900 font-mono">
              Ending in {loan.account_masked}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Monthly EMI
            </span>
            <p className="text-base font-bold text-slate-900">{formatPaise(loan.emi_paise)}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Due Day &amp; Grace
            </span>
            <p className="text-base font-bold text-slate-900">
              Day {loan.due_day}{" "}
              <span className="text-xs font-normal text-slate-500">
                (+{loan.grace_days}d grace)
              </span>
            </p>
          </div>
        </div>

        {/* Payment Instructions Section */}
        {loan.payment_instructions && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-950 uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Family Payment Instructions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {loan.payment_instructions.upi_id && (
                <div className="space-y-0.5">
                  <span className="text-slate-500">Direct UPI ID:</span>
                  <p className="font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                    <QrCode className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    {loan.payment_instructions.upi_id}
                  </p>
                </div>
              )}

              {loan.payment_instructions.portal_url && (
                <div className="space-y-0.5">
                  <span className="text-slate-500">Lender Netbanking Portal:</span>
                  <div>
                    <a
                      href={loan.payment_instructions.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                    >
                      <span>{loan.payment_instructions.portal_url}</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {loan.payment_instructions.notes && (
              <p className="text-xs text-slate-600 pt-1 border-t border-blue-100/60">
                <span className="font-medium text-slate-900">Notes:</span>{" "}
                {loan.payment_instructions.notes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import * as React from "react";
import type { Installment } from "../api/useLoanInstallments";
import { formatISTDate } from "@/shared/lib/dates";
import { formatPaise } from "@/shared/lib/money";
import { StatusPill, type StatusTone } from "@/shared/ui/StatusPill";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Calendar, CheckCircle2, AlertCircle, Clock, FileText } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface InstallmentTimelineProps {
  installments: Installment[];
  onMarkPaidClick?: (installment: Installment) => void;
  className?: string;
}

function getTone(status: string): StatusTone {
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

export const InstallmentTimeline: React.FC<InstallmentTimelineProps> = ({
  installments,
  onMarkPaidClick,
  className,
}) => {
  if (installments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Installment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            No installment cycles generated yet. Once monitoring is active, upcoming installments
            will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort installments chronologically (newest first or chronological)
  const sorted = [...installments].sort((a, b) => b.due_date.localeCompare(a.due_date));

  return (
    <Card className={className}>
      <CardHeader className="pb-4 border-b border-slate-100">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Installment History &amp; Timeline
          </span>
          <span className="text-xs font-normal text-slate-500">
            {installments.length} {installments.length === 1 ? "cycle" : "cycles"} tracked
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {sorted.map((inst) => {
            const tone = getTone(inst.status);
            const isPaid = inst.status.toUpperCase() === "PAID";
            const isMissed = inst.status.toUpperCase() === "MISSED";

            return (
              <div key={inst.year_month} className="relative group">
                {/* Timeline node marker */}
                <div
                  className={cn(
                    "absolute -left-[26px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-2",
                    isPaid
                      ? "bg-emerald-500 ring-emerald-200"
                      : isMissed
                        ? "bg-red-500 ring-red-200"
                        : "bg-slate-400 ring-slate-200",
                  )}
                  aria-hidden="true"
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                        {inst.year_month}
                      </h3>
                      <StatusPill tone={tone} label={inst.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>Due: {formatISTDate(inst.due_date)}</span>
                      <span className="font-semibold text-slate-900">
                        {formatPaise(inst.amount_paise)}
                      </span>
                    </div>

                    {inst.paid_at && (
                      <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium pt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Paid on {formatISTDate(inst.paid_at)}</span>
                      </p>
                    )}

                    {inst.evidence && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>Ref: {inst.evidence}</span>
                      </p>
                    )}

                    {isMissed && (
                      <p className="text-xs text-red-700 flex items-center gap-1 font-medium pt-0.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Payment was not detected before the grace window.</span>
                      </p>
                    )}
                  </div>

                  {!isPaid && onMarkPaidClick && (
                    <Button
                      size="sm"
                      variant={isMissed ? "destructive" : "outline"}
                      className="shrink-0 self-start sm:self-center"
                      onClick={() => onMarkPaidClick(inst)}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      {isMissed ? "I paid late" : "Mark Paid"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

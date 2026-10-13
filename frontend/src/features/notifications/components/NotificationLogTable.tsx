import * as React from "react";
import { Link } from "react-router-dom";
import type { NotificationLogItem } from "../api/useNotifications";
import { StatusPill } from "@/shared/ui/StatusPill";
import { formatDateIST, formatDateTimeIST } from "@/shared/lib/dates";
import { AlertCircle, ArrowRight, Clock, Mail, MessageSquare } from "lucide-react";

export interface NotificationLogTableProps {
  items: NotificationLogItem[];
}

function getStatusTone(status: string): "success" | "warning" | "critical" | "neutral" {
  switch (status.toUpperCase()) {
    case "DELIVERED":
      return "success";
    case "SENT":
      return "neutral";
    case "QUEUED":
      return "warning";
    case "FAILED":
    case "DEAD":
    default:
      return "critical";
  }
}

function formatTemplateName(template: string): string {
  const map: Record<string, string> = {
    inactivity_warn_owner_1_sms: "Inactivity Warning 1 (SMS)",
    inactivity_warn_owner_2_sms: "Inactivity Warning 2 (SMS)",
    inactivity_notify_parents_sms: "90-Day Emergency Alert (SMS)",
    inactivity_notify_parents_email: "90-Day Emergency Alert (Email)",
    loan_due_reminder_owner_sms: "Car Loan Due Reminder (SMS)",
    loan_missed_notify_parents_sms: "Car Loan Missed Alert (SMS)",
    loan_missed_notify_parents_email: "Car Loan Missed Alert (Email)",
    loan_missed_resolved_sms: "Car Loan Resolved Notice (SMS)",
    consent_otp_sms: "Contact Consent Verification OTP",
  };
  return map[template] || template.replace(/_/g, " ");
}

export const NotificationLogTable: React.FC<NotificationLogTableProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-xs text-muted-foreground">
        <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
        <p className="font-semibold text-slate-800">No matching notifications</p>
        <p className="mt-1">Try adjusting your filters or search keywords.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop view: Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th scope="col" className="px-4 py-3">
                Recipient
              </th>
              <th scope="col" className="px-4 py-3">
                Channel
              </th>
              <th scope="col" className="px-4 py-3">
                Message Type
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Attempts
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Queued / Sent
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item) => {
              const isDead = item.status === "DEAD";
              const isFailed = item.status === "FAILED";

              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={`hover:bg-slate-50/50 transition-colors ${isDead ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {item.recipient_label}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {item.channel === "SMS" ? (
                          <MessageSquare className="h-3 w-3 text-blue-600" aria-hidden="true" />
                        ) : (
                          <Mail className="h-3 w-3 text-purple-600" aria-hidden="true" />
                        )}
                        {item.channel}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {formatTemplateName(item.template)}
                    </td>

                    <td className="px-4 py-3.5">
                      <StatusPill tone={getStatusTone(item.status)} label={item.status} />
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono text-slate-600">
                        {item.attempts} {item.attempts === 1 ? "attempt" : "attempts"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono text-slate-600 text-[11px]">
                      {item.sent_at
                        ? formatDateTimeIST(item.sent_at)
                        : formatDateIST(item.queued_at)}
                    </td>
                  </tr>

                  {/* DEAD or FAILED Explanatory Row */}
                  {(isDead || isFailed) && (
                    <tr className="bg-red-50/60 border-b border-red-100">
                      <td colSpan={6} className="px-4 py-2.5">
                        <div className="flex items-center justify-between text-xs text-red-900">
                          <div className="flex items-center gap-2">
                            <AlertCircle
                              className="h-4 w-4 text-red-600 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              <strong>Delivery Failure:</strong>{" "}
                              {item.error_code
                                ? `Carrier reported ${item.error_code}. Message could not be reached after ${item.attempts} tries.`
                                : `Message could not be delivered to ${item.recipient_label}.`}
                            </span>
                          </div>

                          <Link
                            to="/contacts"
                            className="inline-flex items-center gap-1 font-semibold text-red-700 hover:text-red-900 hover:underline shrink-0 text-xs ml-4"
                          >
                            <span>Fix contact in Contacts</span>
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile view: Cards */}
      <div className="block md:hidden space-y-3">
        {items.map((item) => {
          const isDead = item.status === "DEAD";
          const isFailed = item.status === "FAILED";

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border bg-white shadow-sm space-y-2.5 text-xs ${
                isDead ? "border-red-200 bg-red-50/20" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 text-sm">{item.recipient_label}</span>
                <StatusPill tone={getStatusTone(item.status)} label={item.status} />
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                  {item.channel === "SMS" ? (
                    <MessageSquare className="h-3 w-3 text-blue-600" aria-hidden="true" />
                  ) : (
                    <Mail className="h-3 w-3 text-purple-600" aria-hidden="true" />
                  )}
                  {item.channel}
                </span>
                <span>•</span>
                <span className="font-medium text-slate-800">
                  {formatTemplateName(item.template)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-slate-100">
                <span className="font-mono">
                  {item.attempts} {item.attempts === 1 ? "attempt" : "attempts"}
                </span>
                <span>
                  {item.sent_at ? formatDateTimeIST(item.sent_at) : formatDateIST(item.queued_at)}
                </span>
              </div>

              {(isDead || isFailed) && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1.5 pt-2">
                  <p className="font-medium text-[11px]">
                    Failure: {item.error_code || "Delivery unreachable"}
                  </p>
                  <Link
                    to="/contacts"
                    className="inline-flex items-center gap-1 font-semibold text-red-700 hover:underline text-[11px]"
                  >
                    <span>Fix contact details</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

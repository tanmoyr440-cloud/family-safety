import * as React from "react";
import { Link } from "react-router-dom";
import type { Contact } from "@/features/contacts/api/useContacts";
import type { BankAccount } from "@/features/accounts/api/useBankAccounts";
import type { Document } from "@/features/documents/api/useDocuments";
import type { MonitorStatus } from "../api/useMonitorStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

export interface ProtectionCoverageCardProps {
  status: MonitorStatus;
  contacts?: Contact[];
  bankAccounts?: BankAccount[];
  documents?: Document[];
  onOpenSendAlert?: () => void;
}

export const ProtectionCoverageCard: React.FC<ProtectionCoverageCardProps> = ({
  status,
  contacts = [],
  bankAccounts = [],
  documents = [],
  onOpenSendAlert,
}) => {
  const verifiedContacts = contacts.filter((c) => c.consent === "VERIFIED");
  const hasVerifiedContacts = verifiedContacts.length > 0;
  const hasBankAccounts = bankAccounts.length > 0;
  const hasDocuments = documents.length > 0;
  const isHeartbeatActive = status.status !== "PAUSED";

  // Calculate score out of 4
  const activePillars = [
    isHeartbeatActive,
    hasVerifiedContacts,
    hasBankAccounts,
    hasDocuments,
  ].filter(Boolean).length;

  const readinessPercent = Math.round((activePillars / 4) * 100);

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Safety Net Protection Coverage
            </CardTitle>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {readinessPercent}% Armed
          </span>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>{activePillars} of 4 Pillars Active</span>
              <span className="text-slate-500">
                {activePillars === 4 ? "Full Protection" : "Setup Recommended"}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${readinessPercent}%` }}
                className="bg-blue-600 transition-all duration-500 h-full rounded-full"
              />
            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Pillar 1: Inactivity Heartbeat */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-900 block truncate">90-Day Monitor</span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {status.status === "PAUSED" ? "Monitoring Paused" : `${status.threshold_days - status.days_idle}d remaining`}
                  </span>
                </div>
              </div>
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${isHeartbeatActive ? "text-emerald-600" : "text-slate-300"}`} />
            </div>

            {/* Pillar 2: Family Contacts */}
            <Link
              to="/contacts"
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Users className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-900 block truncate group-hover:text-blue-600">
                    Family Contacts
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {hasVerifiedContacts ? `${verifiedContacts.length} Verified` : `${contacts.length} Added (Verify)`}
                  </span>
                </div>
              </div>
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${hasVerifiedContacts ? "text-emerald-600" : "text-amber-500"}`} />
            </Link>

            {/* Pillar 3: Bank Accounts */}
            <Link
              to="/accounts"
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-900 block truncate group-hover:text-blue-600">
                    Bank Accounts
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {hasBankAccounts ? `${bankAccounts.length} Linked Banks` : "None linked"}
                  </span>
                </div>
              </div>
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${hasBankAccounts ? "text-emerald-600" : "text-slate-300"}`} />
            </Link>

            {/* Pillar 4: Emergency Documents */}
            <Link
              to="/documents"
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-900 block truncate group-hover:text-blue-600">
                    Encrypted Vault
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {hasDocuments ? `${documents.length} Files Encrypted` : "No files yet"}
                  </span>
                </div>
              </div>
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${hasDocuments ? "text-emerald-600" : "text-slate-300"}`} />
            </Link>
          </div>
        </CardContent>
      </div>

      {/* Action Footer */}
      <div className="px-5 sm:px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground text-[11px]">
          Ready for automatic failover
        </span>
        {onOpenSendAlert && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSendAlert}
            className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            Send Test Alert
          </Button>
        )}
      </div>
    </Card>
  );
};

import * as React from "react";
import type { PublicPacketSessionData } from "../api/usePublicPacketSession";
import { ParentSimpleGuideCard } from "./ParentSimpleGuideCard";
import { downloadPublicPacketDocument } from "../api/downloadDocument";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Button } from "@/shared/ui/Button";
import {
  Building2,
  CreditCard,
  Download,
  FileText,
  Info,
  Phone,
  Printer,
  ShieldAlert,
} from "lucide-react";

export interface PublicPacketContentProps {
  sessionToken: string;
  packet: PublicPacketSessionData;
}

export const PublicPacketContent: React.FC<PublicPacketContentProps> = ({
  sessionToken,
  packet,
}) => {
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const ownerName = packet.owner_name || "Tanmoy Sharma";
  const daysIdle = packet.days_idle ?? 90;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async (docId: string, filename: string) => {
    try {
      setDownloadError(null);
      setDownloadingId(docId);
      await downloadPublicPacketDocument(sessionToken, docId, filename);
    } catch (err: unknown) {
      setDownloadError((err as Error).message || "Failed to download document.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar (Print / PDF) - hidden in print mode */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-semibold text-slate-900 block">
            Emergency Instructions Packet
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Prepared by {ownerName} for trusted family
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="text-xs font-medium"
        >
          <Printer className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Print / Save PDF
        </Button>
      </div>

      {downloadError && (
        <div
          role="alert"
          className="no-print p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
        >
          {downloadError}
        </div>
      )}

      {/* SECTION 1: WHAT HAPPENED & CALM REASSURANCE */}
      <Card className="page-break-avoid border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
            Overview & First Steps
          </span>
          <CardTitle className="text-lg font-bold text-slate-900">
            Guidance for {ownerName}'s Family
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-950 space-y-2">
            <h3 className="font-semibold text-sm text-blue-950 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              What happened?
            </h3>
            <p>
              We haven't been able to confirm {ownerName} is okay. Their investment check-in records
              have shown no confirmed activity for <strong>{daysIdle} days</strong>.
            </p>
            <p>
              {ownerName} set up Family Safety Net so trusted family members have essential
              information in case they are unreachable. All designated primary family contacts have
              been sent this notice so you can coordinate together.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <h3 className="font-semibold text-slate-900 text-sm">First things to do:</h3>
            <ol className="list-decimal list-inside space-y-2 text-slate-800 pl-1">
              <li>
                <strong>Please try to reach {ownerName} by phone first.</strong> Call their personal
                mobile phone directly to confirm they are safe.
              </li>
              <li>
                <strong>Check with close contacts.</strong> If {ownerName} does not answer, check
                with relatives, roommates, or colleagues.
              </li>
              <li>
                <strong>Review financial obligations below.</strong> Verify whether any scheduled
                loan installments need assistance to prevent auto-debit penalties.
              </li>
            </ol>
          </div>

          {packet.instructions && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 space-y-1">
              <span className="font-semibold text-slate-900 text-[11px] uppercase tracking-wide">
                Personal Note from {ownerName}:
              </span>
              <p className="italic text-xs text-slate-700">"{packet.instructions}"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PARENT SIMPLE STEP-BY-STEP GUIDE */}
      <ParentSimpleGuideCard ownerName={ownerName} loans={packet.loans} />

      {/* SECTION 2: INVESTMENT ACCOUNTS (GROWW) */}
      <Card className="page-break-avoid border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <CardTitle className="text-base font-bold text-slate-900">
              Groww Investment Records
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] text-muted-foreground block">Client Account ID</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">
                {(packet as any).groww_account_id || "XXXX5678"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] text-muted-foreground block">
                Active Portfolio Assets
              </span>
              <span className="font-semibold text-slate-900 text-sm">
                {typeof packet.holdings_summary?.holdings_count === "number" ||
                typeof packet.holdings_summary?.holdings_count === "string"
                  ? String(packet.holdings_summary.holdings_count)
                  : "Tracked in Groww"}{" "}
                holdings
              </span>
              {Boolean(packet.holdings_summary?.as_of) && (
                <span className="text-[10px] text-muted-foreground block">
                  As of: {String(packet.holdings_summary?.as_of)}
                </span>
              )}
            </div>
          </div>

          {/* Detailed holdings with unmasked folios for RTAs/AMCs */}
          {Array.isArray(packet.holdings_summary?.holdings) &&
            packet.holdings_summary.holdings.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-wide block">
                  Asset & Folio Details for Nominee Verification
                </span>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {packet.holdings_summary.holdings.map((h: any, idx: number) => (
                    <div
                      key={h.id || idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 block">
                          {h.scheme_name}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700">
                          <span className="text-muted-foreground font-sans">Folio:</span>
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {h.folio || h.folio_masked || "On Record"}
                          </span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="font-mono font-medium text-slate-800 block">
                          {h.units} units
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {h.asset_type || "Mutual Fund"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Institutional disclaimer: NEVER PROMISE ACCESS TO FUNDS */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">Important Institutional Notice</p>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Claim requirements can change. Please confirm directly with the respective financial
                institutions. Parents and trusted contacts cannot withdraw or claim funds through
                this packet; all settlements require official institutional verification and
                documentation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: LOAN OBLIGATIONS */}
      {packet.loans && packet.loans.length > 0 && (
        <Card className="page-break-avoid border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <CardTitle className="text-base font-bold text-slate-900">
                Active Loan Obligations
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4 text-xs text-slate-700">
            <p className="text-muted-foreground">
              {ownerName} has an ongoing monthly vehicle loan EMI. If auto-debit fails, family may
              pay directly using the lender details below to prevent penalties:
            </p>

            <div className="space-y-3">
              {packet.loans.map((loan) => (
                <div
                  key={loan.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{loan.lender}</span>
                      <span className="text-[11px] text-slate-700 block font-mono">
                        Account: <strong className="text-slate-900">{loan.account_number || loan.account_masked}</strong>
                      </span>
                    </div>
                    <div className="text-right">
                      <MoneyText
                        paise={loan.emi_paise}
                        className="font-bold text-sm text-slate-900 block"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Due on day {loan.due_day}
                      </span>
                    </div>
                  </div>

                  {loan.payment_instructions && (
                    <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px]">
                      {loan.payment_instructions.upi_id && (
                        <p>
                          <span className="font-semibold text-slate-800">UPI ID for payment: </span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                            {loan.payment_instructions.upi_id}
                          </span>
                        </p>
                      )}
                      {loan.payment_instructions.portal_url && (
                        <p>
                          <span className="font-semibold text-slate-800">Payment portal: </span>
                          <span className="font-mono text-blue-600 underline">
                            {loan.payment_instructions.portal_url}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: SAVINGS & BANK ACCOUNTS */}
      {packet.bank_accounts && packet.bank_accounts.length > 0 && (
        <Card className="page-break-avoid border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <CardTitle className="text-base font-bold text-slate-900">
                Savings & Bank Accounts
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4 text-xs text-slate-700">
            <p className="text-muted-foreground">
              {ownerName} holds registered bank accounts at the following banking institutions.
              For formal nominee claim procedures, present the registered account number, IFSC code, death/incapacitation certificate, and your KYC documents:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {packet.bank_accounts.map((account) => (
                <div
                  key={account.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">
                        {account.bank_name}
                      </span>
                      {account.branch_name && (
                        <span className="text-[11px] text-muted-foreground block">
                          {account.branch_name}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {account.account_type || "SAVINGS"}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Number:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {account.account_number || account.account_number_masked}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IFSC Code:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {account.ifsc_code}
                      </span>
                    </div>
                    {account.holder_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Primary Holder:</span>
                        <span className="text-slate-800 font-medium">{account.holder_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 5: DOCUMENTS ON FILE */}
      {packet.documents && packet.documents.length > 0 && (
        <Card className="page-break-avoid border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" aria-hidden="true" />
              <CardTitle className="text-base font-bold text-slate-900">
                Encrypted Emergency Documents
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-3 text-xs text-slate-700">
            <p className="text-muted-foreground">
              These files were uploaded by {ownerName} and are stored with envelope encryption:
            </p>

            <div className="space-y-2">
              {packet.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-slate-900 truncate">{doc.title}</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="no-print shrink-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => handleDownload(doc.id, doc.filename)}
                    isLoading={downloadingId === doc.id}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 5: WHO TO CONTACT */}
      <Card className="page-break-avoid border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <CardTitle className="text-base font-bold text-slate-900">
              Support &amp; Institutional Contacts
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-3 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-900">Groww Customer Support</p>
              <p className="text-muted-foreground">Helpline: +91 910 880 0604</p>
              <p className="text-muted-foreground">Email: support@groww.in</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-900">HDFC Bank Loan Support</p>
              <p className="text-muted-foreground">Retail Loan Helpline: 1800 258 3838</p>
              <p className="text-muted-foreground">Portal: hdfcbank.com</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

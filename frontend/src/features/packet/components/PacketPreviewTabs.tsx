import * as React from "react";
import { usePacketPreview } from "../api/usePacketPreview";
import { useContacts } from "@/features/contacts/api/useContacts";
import { Card, CardContent, CardHeader } from "@/shared/ui/Card";
import { StatusPill } from "@/shared/ui/StatusPill";
import { MoneyText } from "@/shared/ui/MoneyText";
import { maskAccount } from "@/shared/lib/masks";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useMutualFundHoldings } from "@/features/accounts/api/useMutualFunds";
import {
  AlertCircle,
  Building2,
  Eye,
  FileText,
  Mail,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  Smartphone,
  User,
} from "lucide-react";

export interface PacketPreviewTabsProps {
  initialContactId?: string;
}

export const PacketPreviewTabs: React.FC<PacketPreviewTabsProps> = ({ initialContactId }) => {
  const { data: contacts } = useContacts();
  const [selectedContactId, setSelectedContactId] = React.useState<string>(initialContactId || "");
  const [activeTab, setActiveTab] = React.useState<"sms" | "email" | "packet">("sms");

  React.useEffect(() => {
    if (!selectedContactId && contacts && contacts.length > 0) {
      setSelectedContactId(contacts[0]!.id);
    }
  }, [contacts, selectedContactId]);

  const selectedContact = contacts?.find((c) => c.id === selectedContactId) || contacts?.[0];

  const { data: preview, isLoading, error } = usePacketPreview(selectedContactId || null);
  const { data: mutualFunds } = useMutualFundHoldings();

  const ownerName = preview?.owner_name || "Tanmoy Sharma";
  const recipientName = selectedContact?.name || "Parent";
  const daysIdle = preview?.days_idle || 90;

  return (
    <div className="space-y-6">
      {/* Prominent Safety Banner: PREVIEW, NOTHING HAS BEEN SENT */}
      <div
        role="status"
        aria-label="Preview notice"
        className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-800">
            <Eye className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-amber-950 uppercase">
              Preview, nothing has been sent
            </h2>
            <p className="text-xs text-amber-900 mt-0.5">
              This is an exact simulation of what your emergency contact will see if your 90-day
              inactivity threshold is reached or an EMI is missed.
            </p>
          </div>
        </div>

        <StatusPill tone="warning" label="Live Simulation" />
      </div>

      {/* Contact selector and Channel tabs */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <label
              htmlFor="preview-contact-select"
              className="text-xs font-semibold text-slate-700"
            >
              Preview for Contact:
            </label>
            <select
              id="preview-contact-select"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {contacts && contacts.length > 0 ? (
                contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.relation}) — Priority #{c.priority}
                  </option>
                ))
              ) : (
                <option value="">Father (Primary Contact)</option>
              )}
            </select>
          </div>

          {/* Tabs: SMS, Email, Packet page */}
          <div
            className="flex rounded-xl bg-slate-100 p-1"
            role="tablist"
            aria-label="Preview channels"
          >
            <button
              type="button"
              role="tab"
              id="preview-tab-sms"
              aria-controls="preview-panel-sms"
              aria-selected={activeTab === "sms"}
              onClick={() => setActiveTab("sms")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "sms"
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              SMS
            </button>
            <button
              type="button"
              role="tab"
              id="preview-tab-email"
              aria-controls="preview-panel-email"
              aria-selected={activeTab === "email"}
              onClick={() => setActiveTab("email")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "email"
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Email
            </button>
            <button
              type="button"
              role="tab"
              id="preview-tab-packet"
              aria-controls="preview-panel-packet"
              aria-selected={activeTab === "packet"}
              onClick={() => setActiveTab("packet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "packet"
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Packet page
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading && (
            <div className="space-y-3" aria-label="Loading preview">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 text-red-800 text-xs">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p>Unable to load packet preview simulation: {error.message}</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* TAB 1: SMS PREVIEW */}
              {activeTab === "sms" && (
                <div
                  id="preview-panel-sms"
                  role="tabpanel"
                  aria-labelledby="preview-tab-sms"
                  className="max-w-md mx-auto space-y-3"
                >
                  <div className="text-center">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      SMS delivered to{" "}
                      {selectedContact?.phone ? selectedContact.phone : "+91 98*** **211"}
                    </span>
                  </div>

                  {/* Mobile phone chat bubble */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center gap-2 text-xs text-slate-500 pb-1 border-b border-slate-200">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        Sender: <strong>FAMILY-NET</strong>
                      </span>
                    </div>

                    <div className="bg-blue-600 text-white rounded-2xl rounded-tl-sm p-4 text-xs leading-relaxed space-y-2 shadow-sm">
                      <p>
                        <strong>[Family Safety Net]</strong> Hello {recipientName}, we have not
                        heard from {ownerName} in {daysIdle} days.
                      </p>
                      <p>
                        Please try to contact {ownerName} directly. If unreachable, you have been
                        designated to access their emergency safety packet:
                      </p>
                      <p className="font-mono text-[11px] underline text-blue-100">
                        https://safetynet.app/p/demo-emergency-token
                      </p>
                      <p className="text-[10px] text-blue-200 pt-1 border-t border-blue-500/50">
                        An OTP will be required to view the secure packet.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMAIL PREVIEW */}
              {activeTab === "email" && (
                <div
                  id="preview-panel-email"
                  role="tabpanel"
                  aria-labelledby="preview-tab-email"
                  className="max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                >
                  {/* Email Headers */}
                  <div className="bg-slate-50 p-4 border-b border-slate-200 space-y-1.5 text-xs text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-800">Subject: </span>
                      <span className="text-slate-900 font-medium">
                        Important: Please check on {ownerName} — Family Safety Net Notice
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">From: </span>
                      <span>alerts@familysafetynet.app</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">To: </span>
                      <span>{selectedContact?.email || "parent@example.com"}</span>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="p-6 space-y-5 text-xs text-slate-700 leading-relaxed">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-bold text-slate-900">Dear {recipientName},</h3>
                    </div>

                    <p>
                      You are receiving this notification because <strong>{ownerName}</strong>{" "}
                      configured you as their primary trusted contact on Family Safety Net.
                    </p>

                    <p>
                      We have detected that {ownerName} has shown no activity on their investment
                      records for <strong>{daysIdle} days</strong>. As their designated emergency
                      contact, please check on them.
                    </p>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-950 space-y-2">
                      <p className="font-semibold text-xs">First steps to take:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Please call {ownerName} directly to verify they are safe and well.</li>
                        <li>
                          If you cannot reach them, unlock their emergency instructions packet below.
                        </li>
                      </ol>
                    </div>

                    {/* Section 1: Mutual Funds */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        1. Mutual Fund & Investment Portfolio
                      </h4>
                      {mutualFunds && mutualFunds.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                              <tr>
                                <th className="p-2 font-semibold">Scheme & Fund House</th>
                                <th className="p-2 font-semibold">Folio</th>
                                <th className="p-2 font-semibold">Units</th>
                                <th className="p-2 font-semibold text-right">Estimated Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {mutualFunds.map((h) => (
                                <tr key={h.id}>
                                  <td className="p-2 font-medium text-slate-900">
                                    {h.scheme_name}
                                    <span className="block text-[10px] text-slate-500">
                                      {h.fund_house}
                                    </span>
                                  </td>
                                  <td className="p-2 font-mono text-slate-600">
                                    {h.folio_masked || "Recorded"}
                                  </td>
                                  <td className="p-2 font-mono text-slate-600">{h.units}</td>
                                  <td className="p-2 font-semibold text-right text-slate-900">
                                    {h.value_paise ? (
                                      <MoneyText paise={h.value_paise} />
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          Mutual fund investments are registered across CAMS & KFintech RTAs.
                        </p>
                      )}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                        <strong className="text-slate-800">Guidance for Claiming Mutual Funds:</strong>{" "}
                        Contact respective Asset Management Companies (AMCs) or RTAs (CAMS & KFintech)
                        with registered Folio numbers, PAN, and nominee claim documentation.
                      </div>
                    </div>

                    {/* Section 2: Financial Obligations & Loans */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        2. Financial Obligations & Loans
                      </h4>
                      {preview?.loans && preview.loans.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                              <tr>
                                <th className="p-2 font-semibold">Lender</th>
                                <th className="p-2 font-semibold">Account</th>
                                <th className="p-2 font-semibold">Monthly EMI</th>
                                <th className="p-2 font-semibold">Due Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {preview.loans.map((l) => (
                                <tr key={l.id}>
                                  <td className="p-2 font-medium text-slate-900">{l.lender}</td>
                                  <td className="p-2 font-mono text-slate-600">
                                    {maskAccount(l.account_masked)}
                                  </td>
                                  <td className="p-2 font-bold text-red-700">
                                    <MoneyText paise={l.emi_paise} />
                                  </td>
                                  <td className="p-2 text-slate-600">{l.due_day}th of month</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No active loan liabilities registered.
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        Please verify loan payments to avoid default penalties or repossession.
                      </p>
                    </div>

                    {/* Section 3: Savings Bank Accounts */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        3. Savings & Bank Accounts
                      </h4>
                      {preview?.bank_accounts && preview.bank_accounts.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                              <tr>
                                <th className="p-2 font-semibold">Bank & Branch</th>
                                <th className="p-2 font-semibold">Account Number</th>
                                <th className="p-2 font-semibold">IFSC Code</th>
                                <th className="p-2 font-semibold">Type</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {preview.bank_accounts.map((b) => (
                                <tr key={b.id}>
                                  <td className="p-2 font-medium text-slate-900">
                                    {b.bank_name}
                                    {b.branch_name && (
                                      <span className="block text-[10px] text-slate-500">
                                        {b.branch_name}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 font-mono text-slate-600">
                                    {b.account_number_masked}
                                  </td>
                                  <td className="p-2 font-mono text-slate-600">{b.ifsc_code}</td>
                                  <td className="p-2 text-slate-600">{b.account_type || "SAVINGS"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No direct savings bank accounts registered in safety net.
                        </p>
                      )}
                    </div>

                    {/* Section 4: Attached Emergency Documents */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        4. Attached Emergency Documents
                      </h4>
                      {preview?.documents && preview.documents.length > 0 ? (
                        <div className="space-y-2">
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                <tr>
                                  <th className="p-2 font-semibold">Document Title</th>
                                  <th className="p-2 font-semibold">Category</th>
                                  <th className="p-2 font-semibold">Filename</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {preview.documents.map((d) => (
                                  <tr key={d.id}>
                                    <td className="p-2 font-medium text-slate-900">{d.title}</td>
                                    <td className="p-2 text-slate-600 capitalize">
                                      {d.category || "General"}
                                    </td>
                                    <td className="p-2 font-mono text-slate-600">{d.filename}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            ✓ The listed documents are decrypted and attached directly to this email
                            for immediate offline access.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No emergency documents on file to attach.
                        </p>
                      )}
                    </div>

                    {/* Section 5: CTA */}
                    <div className="text-center py-4 border-t border-slate-100 space-y-2">
                      <span className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm">
                        Access Full Emergency Packet
                      </span>
                      <p className="text-slate-500 text-[11px]">
                        Security Notice: Access requires verifying the one-time passcode (OTP)
                        delivered to your registered phone number.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PACKET PAGE PREVIEW */}
              {activeTab === "packet" && (
                <div
                  id="preview-panel-packet"
                  role="tabpanel"
                  aria-labelledby="preview-tab-packet"
                  className="max-w-2xl mx-auto space-y-5 bg-white p-6 rounded-2xl border border-slate-200"
                >
                  <div className="space-y-1 border-b border-slate-100 pb-4">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                      Emergency Information Packet
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      Emergency Guidance for {recipientName}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Prepared by {ownerName} to assist trusted family in case of prolonged
                      inactivity or missed obligations.
                    </p>
                  </div>

                  {/* Calm Guidance Banner */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                    <p className="font-semibold text-slate-900">What happened?</p>
                    <p className="leading-relaxed">
                      {ownerName} has had no verified investment check-ins for {daysIdle} days.
                      Please verify their wellbeing first before taking institutional actions.
                    </p>
                  </div>

                  {/* Loan Obligations */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Active Loan Obligations
                    </h4>
                    {preview?.loans && preview.loans.length > 0 ? (
                      preview.loans.map((loan) => (
                        <div
                          key={loan.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{loan.lender}</span>
                            <MoneyText
                              paise={loan.emi_paise}
                              className="font-bold text-slate-900"
                            />
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            Account:{" "}
                            <span className="font-mono">{maskAccount(loan.account_masked)}</span> •
                            Due on day {loan.due_day} of each month
                          </p>
                          {loan.payment_instructions?.upi_id && (
                            <p className="text-slate-600 text-[11px]">
                              UPI for payment:{" "}
                              <span className="font-mono font-medium">
                                {loan.payment_instructions.upi_id}
                              </span>
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No tracked loan obligations.
                      </p>
                    )}
                  </div>

                  {/* Bank Accounts */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      Savings & Bank Accounts
                    </h4>
                    {preview?.bank_accounts && preview.bank_accounts.length > 0 ? (
                      preview.bank_accounts.map((account) => (
                        <div
                          key={account.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{account.bank_name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {account.account_type || "SAVINGS"}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            Account: <span className="font-mono font-medium">{account.account_number_masked}</span> • IFSC:{" "}
                            <span className="font-mono font-medium">{account.ifsc_code}</span>
                            {account.branch_name ? ` • Branch: ${account.branch_name}` : ""}
                          </p>
                          {account.holder_name && (
                            <p className="text-slate-500 text-[10px]">
                              Primary Holder: {account.holder_name}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No bank accounts recorded.
                      </p>
                    )}
                  </div>

                  {/* Documents list */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Emergency Documents on File
                    </h4>
                    {preview?.documents && preview.documents.length > 0 ? (
                      <div className="space-y-2">
                        {preview.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
                              <span className="font-medium text-slate-800">{doc.title}</span>
                            </div>
                            <span className="text-[11px] text-blue-600 font-medium">Download</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No encrypted documents uploaded yet.
                      </p>
                    )}
                  </div>

                  {/* Mandatory claim note: NEVER PROMISE ACCESS TO FUNDS */}
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <ShieldAlert
                      className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-amber-950">Important Institutional Notice</p>
                      <p className="text-[11px] leading-relaxed mt-0.5 text-amber-800">
                        Claim requirements can change. Please confirm directly with the respective
                        financial institutions. This packet provides guidance and information only;
                        parents and contacts cannot withdraw or claim funds without formal
                        verification.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

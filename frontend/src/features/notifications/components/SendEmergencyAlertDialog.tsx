import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useContacts } from "@/features/contacts/api/useContacts";
import {
  useSendEmergencyAlert,
  type SendEmergencyAlertResponse,
} from "../api/useSendEmergencyAlert";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  Paperclip,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

export interface SendEmergencyAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendEmergencyAlertDialog: React.FC<SendEmergencyAlertDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const sendMutation = useSendEmergencyAlert();

  const [selectedContactId, setSelectedContactId] = React.useState<string>("");
  const [customSubject, setCustomSubject] = React.useState<string>("");
  const [lastResult, setLastResult] = React.useState<SendEmergencyAlertResponse | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Initialize selected contact when contacts load
  React.useEffect(() => {
    if (!selectedContactId && contacts && contacts.length > 0) {
      const verifiedContact = contacts.find((c) => c.consent === "VERIFIED");
      setSelectedContactId(verifiedContact ? verifiedContact.id : contacts[0]!.id);
    }
  }, [contacts, selectedContactId]);

  // Reset state when dialog reopens
  React.useEffect(() => {
    if (open) {
      setLastResult(null);
      setErrorMsg(null);
    }
  }, [open]);

  const handleSend = async () => {
    setErrorMsg(null);
    try {
      const response = await sendMutation.mutateAsync({
        contact_id: selectedContactId || undefined,
        subject: customSubject.trim() || undefined,
      });
      setLastResult(response);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to dispatch emergency alert email.";
      setErrorMsg(message);
    }
  };

  const selectedContact = contacts?.find((c) => c.id === selectedContactId) || contacts?.[0];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-4",
            "border border-border bg-background p-6 shadow-xl duration-200 sm:rounded-2xl max-h-[90vh] overflow-y-auto",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" aria-hidden="true" />
                Send Emergency Alert Email
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground mt-0.5">
                Dispatch verified emergency dossier to your trusted contact with attached documents.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Success View */}
          {lastResult ? (
            <div className="space-y-4 py-2" data-testid="send-alert-success">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-emerald-950">
                  Emergency Alert Dispatched Successfully
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                  The emergency notification email has been dispatched via{" "}
                  <strong>{lastResult.channel}</strong>. All financial records and decrypted
                  documents were delivered to <strong>{lastResult.recipient}</strong>.
                </p>
              </div>

              {/* Delivery Metadata */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Subject:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[280px]">
                    {lastResult.subject}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Recipient:</span>
                  <span className="font-semibold text-slate-900">{lastResult.recipient}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Financial Dossier Contents:</span>
                  <span className="font-medium text-slate-800">
                    {lastResult.total_holdings} mutual funds • {lastResult.total_loans} loans •{" "}
                    {lastResult.total_bank_accounts} bank accounts
                  </span>
                </div>
                <div className="pt-0.5 space-y-1.5">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    Attached Emergency Documents ({lastResult.attached_documents?.length || 0}):
                  </span>
                  {lastResult.attached_documents && lastResult.attached_documents.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {lastResult.attached_documents.map((filename, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-200"
                        >
                          <FileText className="h-3 w-3 text-blue-600" aria-hidden="true" />
                          {filename}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      No documents currently uploaded to attach.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Dispatch Form */
            <div className="space-y-4 py-1">
              {/* Recipient Selection */}
              <div className="space-y-1.5">
                <label
                  htmlFor="alert-recipient-select"
                  className="text-xs font-semibold text-slate-800 block"
                >
                  Recipient Trusted Contact
                </label>
                <select
                  id="alert-recipient-select"
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  disabled={contactsLoading || sendMutation.isPending}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {contacts && contacts.length > 0 ? (
                    contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.relation}) — {c.email || c.phone}{" "}
                        {c.consent === "VERIFIED" ? "✓" : `[${c.consent}]`}
                      </option>
                    ))
                  ) : (
                    <option value="">No contacts configured</option>
                  )}
                </select>
                {selectedContact?.email ? (
                  <p className="text-[11px] text-muted-foreground">
                    Email will be delivered directly to{" "}
                    <strong className="text-slate-800">{selectedContact.email}</strong>.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700">
                    Warning: Contact does not have an email address recorded.
                  </p>
                )}
              </div>

              {/* Subject Line (Optional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="alert-subject-input"
                  className="text-xs font-semibold text-slate-800 block"
                >
                  Email Subject Line{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="alert-subject-input"
                  type="text"
                  placeholder="Emergency Alert & Verified Financial Dossier: Tanmoy Sharma"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  disabled={sendMutation.isPending}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* What will be included overview */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2.5 text-xs text-blue-950">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <ShieldAlert className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  What will be included in this emergency email:
                </div>
                <ul className="space-y-1.5 text-[11px] text-blue-900 list-disc list-inside">
                  <li>
                    <strong>Mutual Fund Holdings</strong>: Groww/CAS portfolio with folios, units,
                    and valuations.
                  </li>
                  <li>
                    <strong>Car Loan Obligations</strong>: Monthly EMI of ₹16,166 due on 24th with
                    repayment details.
                  </li>
                  <li>
                    <strong>Savings Bank Accounts</strong>: Registered bank accounts with masked
                    numbers and IFSC codes.
                  </li>
                  <li>
                    <strong>Encrypted Documents Attached</strong>: All uploaded emergency documents
                    (Aadhaar, Loan Agreement, Insurance) are decrypted and attached to the email.
                  </li>
                  <li>
                    <strong>Institutional Nominee Guidance</strong>: Step-by-step instructions for
                    AMCs/RTAs and secure emergency packet link with OTP protection.
                  </li>
                </ul>
              </div>

              {/* Error Display */}
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5 text-xs text-red-900"
                >
                  <AlertCircle
                    className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold">Unable to dispatch email</p>
                    <p className="text-[11px] text-red-800 mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendMutation.isPending}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSend}
                  isLoading={sendMutation.isPending}
                  disabled={sendMutation.isPending || (contacts && contacts.length === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Send Alert Email with Attachments
                </Button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

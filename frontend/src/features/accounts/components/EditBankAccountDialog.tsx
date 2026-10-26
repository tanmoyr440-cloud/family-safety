import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useUpdateBankAccount, type BankAccount } from "../api/useBankAccounts";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/utils";
import { AlertCircle, Building2, Loader2, Save, ShieldCheck, X } from "lucide-react";

export interface EditBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
}

const COMMON_BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
];

const ACCOUNT_TYPES = [
  { value: "SAVINGS", label: "Savings Account" },
  { value: "CURRENT", label: "Current Account" },
  { value: "SALARY", label: "Salary Account" },
];

export const EditBankAccountDialog: React.FC<EditBankAccountDialogProps> = ({
  open,
  onOpenChange,
  account,
}) => {
  const [bankName, setBankName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = React.useState("");
  const [ifscCode, setIfscCode] = React.useState("");
  const [branchName, setBranchName] = React.useState("");
  const [accountType, setAccountType] = React.useState("SAVINGS");
  const [holderName, setHolderName] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const { mutate: updateAccount, isPending, error: apiError } = useUpdateBankAccount();

  React.useEffect(() => {
    if (account && open) {
      setBankName(account.bank_name || "");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setIfscCode(account.ifsc_code || "");
      setBranchName(account.branch_name || "");
      setAccountType(account.account_type || "SAVINGS");
      setHolderName(account.holder_name || "");
      setLocalError(null);
    }
  }, [account, open]);

  if (!account) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanBank = bankName.trim();
    if (!cleanBank) {
      setLocalError("Please enter a bank name.");
      return;
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      setLocalError(
        "Invalid IFSC format. IFSC must be 11 characters with 0 as the 5th character (e.g. SBIN0001234).",
      );
      return;
    }

    const cleanAcc = accountNumber.trim().replace(/[\s-]/g, "");
    if (cleanAcc) {
      if (cleanAcc.length < 4) {
        setLocalError("New account number must be at least 4 digits.");
        return;
      }
      if (cleanAcc !== confirmAccountNumber.trim().replace(/[\s-]/g, "")) {
        setLocalError("Account numbers do not match. Please verify.");
        return;
      }
    }

    const payload: {
      bank_name: string;
      account_number?: string;
      ifsc_code: string;
      branch_name?: string;
      account_type: string;
      holder_name?: string;
    } = {
      bank_name: cleanBank,
      ifsc_code: cleanIfsc,
      account_type: accountType,
      branch_name: branchName.trim() || undefined,
      holder_name: holderName.trim() || undefined,
    };

    if (cleanAcc) {
      payload.account_number = cleanAcc;
    }

    updateAccount(
      {
        id: account.id,
        data: payload,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const errorMessage = localError || apiError?.message;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4",
            "border border-slate-200 bg-white p-6 shadow-xl duration-200 sm:rounded-2xl max-h-[90vh] overflow-y-auto",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                Edit Bank Account
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-slate-500">
                Update details for {account.bank_name} ({account.account_number_masked}).
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {account.has_unmasked_account === false && (
            <div
              role="alert"
              className="p-3 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="leading-relaxed">
                <span className="font-semibold block">Full account number missing for emergency alerts</span>
                Enter your complete account number below so your emergency contacts receive the real, unmasked account number via email & SMS when needed.
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 text-xs rounded-xl bg-red-50 border border-red-200 text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Bank Selection */}
            <div className="space-y-1.5">
              <label htmlFor="edit-bank-name-input" className="text-xs font-semibold text-slate-800">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-bank-name-input"
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India, HDFC Bank"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_BANKS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBankName(b)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-lg border transition-colors",
                      bankName === b
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Type */}
            <div className="space-y-1.5">
              <label htmlFor="edit-account-type-select" className="text-xs font-semibold text-slate-800">
                Account Type
              </label>
              <select
                id="edit-account-type-select"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Number & Confirm */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">Update Account Number</span>
                <span className="font-mono text-slate-500">
                  Current: {account.account_number_masked}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave blank to keep existing number, or enter full digits to update. Masked in UI; unmasked in alerts.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label htmlFor="edit-acc-num-input" className="text-[11px] font-medium text-slate-700">
                    Full Account Number
                  </label>
                  <input
                    id="edit-acc-num-input"
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter full number"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="edit-confirm-acc-input" className="text-[11px] font-medium text-slate-700">
                    Confirm Account Number
                  </label>
                  <input
                    id="edit-confirm-acc-input"
                    type="password"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    placeholder="Re-enter to confirm"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* IFSC Code & Branch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-ifsc-input" className="text-xs font-semibold text-slate-800">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-ifsc-input"
                  type="text"
                  maxLength={11}
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-branch-input" className="text-xs font-semibold text-slate-800">
                  Branch Name (Optional)
                </label>
                <input
                  id="edit-branch-input"
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Koramangala Branch"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Account Holder Name */}
            <div className="space-y-1.5">
              <label htmlFor="edit-holder-name-input" className="text-xs font-semibold text-slate-800">
                Primary Account Holder Name (Optional)
              </label>
              <input
                id="edit-holder-name-input"
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Name as registered with the bank"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed">
                For security, your account number is always displayed masked in the UI. When notifications are sent to your verified emergency contacts, full unmasked account details are securely provided so they can claim your funds.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

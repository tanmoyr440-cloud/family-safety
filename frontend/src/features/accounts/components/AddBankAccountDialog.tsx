import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAddBankAccount } from "../api/useBankAccounts";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/utils";
import { Building2, Loader2, Plus, ShieldCheck, X } from "lucide-react";

export interface AddBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const AddBankAccountDialog: React.FC<AddBankAccountDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [bankName, setBankName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = React.useState("");
  const [ifscCode, setIfscCode] = React.useState("");
  const [branchName, setBranchName] = React.useState("");
  const [accountType, setAccountType] = React.useState("SAVINGS");
  const [holderName, setHolderName] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const { mutate: addAccount, isPending, error: apiError } = useAddBankAccount();

  React.useEffect(() => {
    if (!open) {
      setBankName("");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setIfscCode("");
      setBranchName("");
      setAccountType("SAVINGS");
      setHolderName("");
      setLocalError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanBank = bankName.trim();
    if (!cleanBank) {
      setLocalError("Please enter or select a bank name.");
      return;
    }

    const cleanAcc = accountNumber.trim().replace(/[\s-]/g, "");
    if (cleanAcc.length < 4) {
      setLocalError("Account number must be at least 4 digits.");
      return;
    }

    if (cleanAcc !== confirmAccountNumber.trim().replace(/[\s-]/g, "")) {
      setLocalError("Account numbers do not match. Please verify.");
      return;
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      setLocalError(
        "Invalid IFSC format. IFSC must be 11 characters with 0 as the 5th character (e.g. SBIN0001234 or HDFC0000001).",
      );
      return;
    }

    addAccount(
      {
        bank_name: cleanBank,
        account_number: cleanAcc,
        ifsc_code: cleanIfsc,
        branch_name: branchName.trim() || undefined,
        account_type: accountType,
        holder_name: holderName.trim() || undefined,
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
                Add Bank Account
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-slate-500">
                Register a savings or current bank account. Details are shared in the emergency packet for claim processing.
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
              <label htmlFor="bank-name-input" className="text-xs font-semibold text-slate-800">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                id="bank-name-input"
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
              <label htmlFor="account-type-select" className="text-xs font-semibold text-slate-800">
                Account Type
              </label>
              <select
                id="account-type-select"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="acc-num-input" className="text-xs font-semibold text-slate-800">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="acc-num-input"
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 123456789012"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm-acc-input" className="text-xs font-semibold text-slate-800">
                  Confirm Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirm-acc-input"
                  type="password"
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  placeholder="Re-enter account number"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* IFSC Code & Branch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="ifsc-input" className="text-xs font-semibold text-slate-800">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="ifsc-input"
                  type="text"
                  maxLength={11}
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-muted-foreground block">
                  11 alphanumeric characters
                </span>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="branch-input" className="text-xs font-semibold text-slate-800">
                  Branch Name (Optional)
                </label>
                <input
                  id="branch-input"
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
              <label htmlFor="holder-name-input" className="text-xs font-semibold text-slate-800">
                Primary Account Holder Name (Optional)
              </label>
              <input
                id="holder-name-input"
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
                For security, your account number will always be displayed in masked format (e.g.{" "}
                <span className="font-mono font-medium">XXXX1234</span>) in the dashboard and preview packet.
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
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Save Bank Account
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

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useUpdateInsurancePolicy, type InsurancePolicy } from "../api/useInsurancePolicies";
import { Button } from "@/shared/ui/Button";
import { HeartPulse, Loader2, Save, ShieldCheck, X } from "lucide-react";

export interface EditInsurancePolicyDialogProps {
  policy: InsurancePolicy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditInsurancePolicyDialog: React.FC<EditInsurancePolicyDialogProps> = ({
  policy,
  open,
  onOpenChange,
}) => {
  const [policyName, setPolicyName] = React.useState("");
  const [policyType, setPolicyType] = React.useState("HEALTH");
  const [policyNumber, setPolicyNumber] = React.useState("");
  const [insurerName, setInsurerName] = React.useState("");
  const [sumInsuredInr, setSumInsuredInr] = React.useState<string>("0");
  const [premiumInr, setPremiumInr] = React.useState<string>("");
  const [dueDate, setDueDate] = React.useState<string>("");
  const [tpaName, setTpaName] = React.useState("");
  const [tpaId, setTpaId] = React.useState("");
  const [emergencyPhone, setEmergencyPhone] = React.useState("");
  const [claimEmail, setClaimEmail] = React.useState("");
  const [nomineeName, setNomineeName] = React.useState("");
  const [nomineeRelation, setNomineeRelation] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const { mutate: updatePolicy, isPending, error: apiError } = useUpdateInsurancePolicy();

  React.useEffect(() => {
    if (policy && open) {
      setPolicyName(policy.policy_name);
      setPolicyType(policy.policy_type);
      setPolicyNumber(policy.policy_number || policy.policy_number_masked);
      setInsurerName(policy.insurer_name);
      setSumInsuredInr(String(Math.round(policy.sum_insured_paise / 100)));
      setPremiumInr(
        policy.premium_amount_paise ? String(Math.round(policy.premium_amount_paise / 100)) : "",
      );
      setDueDate(policy.premium_due_date || "");
      setTpaName(policy.cashless_tpa_name || "");
      setTpaId(policy.tpa_id_number || "");
      setEmergencyPhone(policy.emergency_helpline || "");
      setClaimEmail(policy.claim_email || "");
      setNomineeName(policy.nominee_name || "");
      setNomineeRelation(policy.nominee_relation || "");
      setNotes(policy.hospital_cashless_notes || "");
      setLocalError(null);
    }
  }, [policy, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setLocalError(null);

    const cleanName = policyName.trim();
    if (!cleanName) {
      setLocalError("Please enter a policy name.");
      return;
    }

    const cleanInsurer = insurerName.trim();
    if (!cleanInsurer) {
      setLocalError("Please enter an insurer name.");
      return;
    }

    const parsedSumInr = Number(sumInsuredInr);
    if (isNaN(parsedSumInr) || parsedSumInr < 0) {
      setLocalError("Please enter a valid sum insured amount in Rupees.");
      return;
    }
    const sumInsuredPaise = Math.round(parsedSumInr * 100);

    const parsedPremInr = premiumInr ? Number(premiumInr) : null;
    const premiumPaise = parsedPremInr && !isNaN(parsedPremInr) ? Math.round(parsedPremInr * 100) : null;

    updatePolicy(
      {
        id: policy.id,
        data: {
          policy_name: cleanName,
          policy_type: policyType,
          policy_number: policyNumber.trim().replace(/\s+/g, ""),
          insurer_name: cleanInsurer,
          sum_insured_paise: sumInsuredPaise,
          premium_amount_paise: premiumPaise,
          premium_due_date: dueDate || null,
          cashless_tpa_name: tpaName.trim() || null,
          tpa_id_number: tpaId.trim() || null,
          emergency_helpline: emergencyPhone.trim() || null,
          claim_email: claimEmail.trim() || null,
          nominee_name: nomineeName.trim() || null,
          nominee_relation: nomineeRelation.trim() || null,
          hospital_cashless_notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (err: any) => {
          setLocalError(err?.message || "Failed to update insurance policy.");
        },
      },
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl max-h-[90vh] overflow-y-auto"
          aria-describedby="edit-policy-description"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                  Edit Insurance Policy
                </DialogPrimitive.Title>
                <p id="edit-policy-description" className="text-xs text-muted-foreground mt-0.5">
                  Update coverage amount, cashless TPA ID, emergency contacts, or nominee instructions.
                </p>
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(localError || apiError) && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
                {localError || (apiError as any)?.message}
              </div>
            )}

            {/* Policy Category & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <label className="text-xs font-semibold text-foreground">Policy Category *</label>
                <select
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="HEALTH">Health (Mediclaim)</option>
                  <option value="TERM_LIFE">Term Life Insurance</option>
                  <option value="CRITICAL_ILLNESS">Critical Illness</option>
                  <option value="MOTOR">Motor / Vehicle</option>
                  <option value="OTHER">Other Policy</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Policy Name / Plan *</label>
                <input
                  type="text"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Insurer Name & Policy Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Insurer Name *</label>
                <input
                  type="text"
                  value={insurerName}
                  onChange={(e) => setInsurerName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Policy Number</label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Sum Insured & Premium */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <label className="text-xs font-semibold text-foreground">Sum Insured (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={sumInsuredInr}
                  onChange={(e) => setSumInsuredInr(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <label className="text-xs font-semibold text-foreground">Annual Premium (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={premiumInr}
                  onChange={(e) => setPremiumInr(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <label className="text-xs font-semibold text-foreground">Next Renewal Due</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* TPA & Cashless Information */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 p-4 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Cashless Hospitalization & TPA Card Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">TPA Network Desk</label>
                  <input
                    type="text"
                    value={tpaName}
                    onChange={(e) => setTpaName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">TPA / Member Card ID</label>
                  <input
                    type="text"
                    value={tpaId}
                    onChange={(e) => setTpaId(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    24x7 Emergency Claim Helpline
                  </label>
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Claim Intimation Email</label>
                  <input
                    type="email"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Nominee & Family Guidance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Nominee Name</label>
                <input
                  type="text"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Nominee Relation</label>
                <input
                  type="text"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Specific Instructions for Family */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Hospital Desk / Claim Instructions for Family
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-4 w-4" />
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

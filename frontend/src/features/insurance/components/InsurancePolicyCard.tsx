import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Calendar,
  CreditCard,
  Edit2,
  FileCheck2,
  HeartPulse,
  PhoneCall,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { formatPaise } from "@/shared/lib/money";
import { TpaDigitalCard } from "./TpaDigitalCard";
import { CashlessClaimPlaybookModal } from "./CashlessClaimPlaybookModal";
import { EditInsurancePolicyDialog } from "./EditInsurancePolicyDialog";
import { useDeleteInsurancePolicy, type InsurancePolicy } from "../api/useInsurancePolicies";

export interface InsurancePolicyCardProps {
  policy: InsurancePolicy;
}

export const InsurancePolicyCard: React.FC<InsurancePolicyCardProps> = ({ policy }) => {
  const [tpaCardOpen, setTpaCardOpen] = React.useState(false);
  const [playbookOpen, setPlaybookOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  const { mutate: deletePolicy, isPending: isDeleting } = useDeleteInsurancePolicy();

  const isHealth = policy.policy_type === "HEALTH";
  const isTermLife = policy.policy_type === "TERM_LIFE";

  const getCategoryColor = () => {
    if (isHealth) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    if (isTermLife) return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  };

  const getCategoryLabel = () => {
    switch (policy.policy_type) {
      case "HEALTH":
        return "Health (Mediclaim)";
      case "TERM_LIFE":
        return "Term Life";
      case "CRITICAL_ILLNESS":
        return "Critical Illness";
      case "MOTOR":
        return "Motor";
      default:
        return policy.policy_type;
    }
  };

  return (
    <>
      <Card className="overflow-hidden border transition-all hover:shadow-md">
        <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start justify-between gap-4 border-b bg-muted/20">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isHealth
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-blue-500/10 text-blue-600 border-blue-500/20"
              }`}
            >
              {isHealth ? <HeartPulse className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getCategoryColor()}`}
                >
                  {getCategoryLabel()}
                </span>
                {policy.cashless_tpa_name && (
                  <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-md border font-medium">
                    TPA: {policy.cashless_tpa_name}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-foreground mt-1 leading-snug">
                {policy.policy_name}
              </h3>
              <p className="text-xs text-muted-foreground">{policy.insurer_name}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Sum Insured
            </span>
            <span className="text-base sm:text-lg font-extrabold text-foreground">
              {formatPaise(policy.sum_insured_paise)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Key Identifiers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-muted/30 p-3 text-xs border">
            <div>
              <span className="text-muted-foreground block text-[11px]">Policy Number</span>
              <span className="font-mono font-semibold text-foreground">
                {policy.policy_number || policy.policy_number_masked}
              </span>
            </div>

            {policy.tpa_id_number && (
              <div>
                <span className="text-muted-foreground block text-[11px]">TPA / Member ID</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {policy.tpa_id_number}
                </span>
              </div>
            )}

            {policy.emergency_helpline && (
              <div>
                <span className="text-muted-foreground block text-[11px]">24x7 Helpline</span>
                <a
                  href={`tel:${policy.emergency_helpline.replace(/\s+/g, "")}`}
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <PhoneCall className="h-3 w-3" />
                  {policy.emergency_helpline}
                </a>
              </div>
            )}

            {policy.nominee_name && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Nominee</span>
                <span className="font-medium text-foreground">
                  {policy.nominee_name}
                  {policy.nominee_relation ? ` (${policy.nominee_relation})` : ""}
                </span>
              </div>
            )}

            {policy.premium_due_date && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Next Renewal</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {policy.premium_due_date}
                </span>
              </div>
            )}
          </div>

          {/* Quick Hospital Note if any */}
          {policy.hospital_cashless_notes && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <strong>Family Note:</strong> {policy.hospital_cashless_notes}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTpaCardOpen(true)}
                className="h-8 text-xs font-semibold border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                Digital TPA Card
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPlaybookOpen(true)}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                Claim Playbook
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Edit policy"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete policy"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal 1: Digital TPA Card */}
      <DialogPrimitive.Root open={tpaCardOpen} onOpenChange={setTpaCardOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-4 p-4 duration-200">
            <TpaDigitalCard policy={policy} onClose={() => setTpaCardOpen(false)} />
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTpaCardOpen(false)}
                className="text-white hover:bg-white/10"
              >
                Close Card
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Modal 2: Claim Playbook SOP */}
      <CashlessClaimPlaybookModal
        open={playbookOpen}
        onOpenChange={setPlaybookOpen}
        policyType={policy.policy_type}
        policyName={policy.policy_name}
        insurerName={policy.insurer_name}
        helpline={policy.emergency_helpline}
      />

      {/* Modal 3: Edit Policy */}
      <EditInsurancePolicyDialog
        policy={policy}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Modal 4: Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Remove Insurance Policy?"
        description={`Are you sure you want to remove ${policy.policy_name}? This will remove it from your emergency packet and parent claim portal.`}
        confirmLabel={isDeleting ? "Removing..." : "Remove Policy"}
        variant="destructive"
        onConfirm={() => {
          deletePolicy(policy.id, {
            onSuccess: () => setDeleteConfirmOpen(false),
          });
        }}
      />
    </>
  );
};

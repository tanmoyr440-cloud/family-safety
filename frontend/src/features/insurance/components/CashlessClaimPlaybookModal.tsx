import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  HeartPulse,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { useInsuranceClaimPlaybook } from "../api/useInsurancePolicies";

export interface CashlessClaimPlaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyType: string;
  policyName?: string;
  insurerName?: string;
  helpline?: string | null;
}

export const CashlessClaimPlaybookModal: React.FC<CashlessClaimPlaybookModalProps> = ({
  open,
  onOpenChange,
  policyType,
  policyName,
  insurerName,
  helpline,
}) => {
  const { data: playbook, isLoading } = useInsuranceClaimPlaybook(policyType);

  const isHealth = policyType === "HEALTH";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl max-h-[90vh] overflow-y-auto"
          aria-describedby="playbook-description"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                {isHealth ? <HeartPulse className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
              </div>
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                  {playbook?.title || (isHealth ? "Hospital Cashless Claim SOP" : "Insurance Claim SOP")}
                </DialogPrimitive.Title>
                <p id="playbook-description" className="text-xs text-muted-foreground mt-0.5">
                  {policyName ? `${policyName} (${insurerName || "Insurer"})` : "Official Family Emergency SOP"}
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

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Critical Timeline Rule Callout */}
              {playbook?.timeline_rule && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/40">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Critical Timeline Rule
                      </h4>
                      <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5 font-medium">
                        {playbook.timeline_rule}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step-by-Step Instructions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Step-by-Step Claim Playbook
                </h4>
                <div className="space-y-3">
                  {playbook?.steps.map((s) => (
                    <div
                      key={s.step_number}
                      className="flex items-start gap-3 rounded-xl border bg-card p-3.5 shadow-2xs"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                        {s.step_number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-semibold text-foreground">{s.title}</h5>
                          {s.important && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-sm">
                              Crucial
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {s.instruction}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents Required Checklist */}
              {playbook?.documents_checklist && playbook.documents_checklist.length > 0 && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Documents Required for Claim Submission
                    </h4>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {playbook.documents_checklist.map((doc, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Emergency Hotline Banner */}
              {helpline && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 text-white p-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Emergency Claim Hotline
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-400">
                      {helpline}
                    </span>
                  </div>
                  <a
                    href={`tel:${helpline.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    Call Now
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close Playbook
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

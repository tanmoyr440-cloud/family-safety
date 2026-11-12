import * as React from "react";
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  HeartPulse,
  PhoneCall,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { formatPaise } from "@/shared/lib/money";
import type { InsurancePolicy } from "../api/useInsurancePolicies";

export interface TpaDigitalCardProps {
  policy: InsurancePolicy;
  onClose?: () => void;
}

export const TpaDigitalCard: React.FC<TpaDigitalCardProps> = ({ policy }) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isHealth = policy.policy_type === "HEALTH";
  const displayPolicyNumber = policy.policy_number || policy.policy_number_masked;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-2xl p-6 sm:p-7">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
            {isHealth ? <HeartPulse className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                {isHealth ? "Emergency Cashless Health Card" : "Emergency Life Policy"}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white leading-tight mt-0.5">
              {policy.policy_name}
            </h3>
            <p className="text-xs text-slate-400">{policy.insurer_name}</p>
          </div>
        </div>

        {policy.sum_insured_paise > 0 && (
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Sum Insured</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-400">
              {formatPaise(policy.sum_insured_paise)}
            </span>
          </div>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Policy Number */}
        <div className="rounded-xl bg-white/5 p-3.5 border border-white/10">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
            Policy Number
          </span>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wide">
              {displayPolicyNumber}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(displayPolicyNumber, "policy")}
              className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/10"
              aria-label="Copy policy number"
            >
              {copiedField === "policy" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1" />
              )}
              {copiedField === "policy" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* TPA Card ID */}
        <div className="rounded-xl bg-white/5 p-3.5 border border-white/10">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
            TPA / Member ID
          </span>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm sm:text-base font-bold text-emerald-300 tracking-wide">
              {policy.tpa_id_number || "Refer Policy Number"}
            </span>
            {policy.tpa_id_number && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(policy.tpa_id_number || "", "tpa")}
                className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/10"
                aria-label="Copy TPA ID"
              >
                {copiedField === "tpa" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                {copiedField === "tpa" ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
        </div>

        {/* Cashless TPA Network */}
        {policy.cashless_tpa_name && (
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              TPA Desk: <strong className="text-white">{policy.cashless_tpa_name}</strong>
            </span>
          </div>
        )}

        {/* Nominee */}
        {policy.nominee_name && (
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Nominee: <strong className="text-white">{policy.nominee_name}</strong>
              {policy.nominee_relation ? ` (${policy.nominee_relation})` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Emergency Admission Instructions */}
      <div className="mt-5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 p-3.5">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-100">
            <strong className="text-white block font-semibold mb-0.5">
              Hospital Admission Desk Instructions:
            </strong>
            {policy.hospital_cashless_notes || (
              <span>
                Show this digital card at the hospital TPA desk within <strong>24 hours</strong> of
                emergency admission. No deposit is required up to the authorized limit.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Helpline Call Action */}
      {policy.emergency_helpline && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            24x7 Emergency Claim Assistance Hotline
          </div>
          <a
            href={`tel:${policy.emergency_helpline.replace(/\s+/g, "")}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md hover:bg-emerald-400 transition-colors"
          >
            <PhoneCall className="h-4 w-4" />
            Call {policy.emergency_helpline}
          </a>
        </div>
      )}
    </div>
  );
};

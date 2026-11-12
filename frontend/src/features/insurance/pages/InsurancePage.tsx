import * as React from "react";
import {
  CheckCircle2,
  CreditCard,
  HeartPulse,
  LifeBuoy,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { formatPaise } from "@/shared/lib/money";
import { useInsurancePolicies } from "../api/useInsurancePolicies";
import { InsurancePolicyCard } from "../components/InsurancePolicyCard";
import { AddInsurancePolicyDialog } from "../components/AddInsurancePolicyDialog";

type PolicyFilter = "ALL" | "HEALTH" | "TERM_LIFE" | "OTHER";

export const InsurancePage: React.FC = () => {
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<PolicyFilter>("ALL");

  const { data: policies, isLoading, isError, refetch } = useInsurancePolicies();

  const allPolicies = policies || [];

  // Filtered policies
  const filteredPolicies = React.useMemo(() => {
    if (filter === "ALL") return allPolicies;
    if (filter === "HEALTH") return allPolicies.filter((p) => p.policy_type === "HEALTH");
    if (filter === "TERM_LIFE") return allPolicies.filter((p) => p.policy_type === "TERM_LIFE");
    return allPolicies.filter((p) => p.policy_type !== "HEALTH" && p.policy_type !== "TERM_LIFE");
  }, [allPolicies, filter]);

  // Aggregate metrics
  const totalHealthPaise = React.useMemo(() => {
    return allPolicies
      .filter((p) => p.policy_type === "HEALTH")
      .reduce((sum, p) => sum + (p.sum_insured_paise || 0), 0);
  }, [allPolicies]);

  const totalLifePaise = React.useMemo(() => {
    return allPolicies
      .filter((p) => p.policy_type === "TERM_LIFE")
      .reduce((sum, p) => sum + (p.sum_insured_paise || 0), 0);
  }, [allPolicies]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Emergency Preparedness
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Insurance & Cashless Claim Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Store health insurance cards, cashless TPA numbers, and emergency claim instructions for your family.
          </p>
        </div>

        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs self-start sm:self-auto"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Insurance Policy
        </Button>
      </div>

      {/* Aggregate Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Health Cover */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-background to-background dark:from-emerald-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Health Cover
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5">
                {formatPaise(totalHealthPaise)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {allPolicies.filter((p) => p.policy_type === "HEALTH").length} Health Policies Active
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <HeartPulse className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Term Life Cover */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-background to-background dark:from-blue-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Term Life Cover
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5">
                {formatPaise(totalLifePaise)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {allPolicies.filter((p) => p.policy_type === "TERM_LIFE").length} Term Life Policies
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Registered Policies */}
        <Card className="bg-gradient-to-br from-slate-50/50 via-background to-background dark:from-slate-900/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Family Emergency Dossier
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5">
                {allPolicies.length} Policies
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ready in Parent Packet
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
              <CreditCard className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "ALL"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          All Policies ({allPolicies.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("HEALTH")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "HEALTH"
              ? "bg-emerald-600 text-white"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Health & Cashless ({allPolicies.filter((p) => p.policy_type === "HEALTH").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("TERM_LIFE")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "TERM_LIFE"
              ? "bg-blue-600 text-white"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Term Life ({allPolicies.filter((p) => p.policy_type === "TERM_LIFE").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("OTHER")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "OTHER"
              ? "bg-slate-700 text-white"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Other
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive font-medium">
            Failed to load insurance policies.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Retry
          </Button>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-10 w-10 text-emerald-500" />}
          title={filter === "ALL" ? "No Insurance Policies Registered Yet" : "No Policies in this Category"}
          description="In an emergency, your parents need immediate access to your health insurance TPA card, policy number, and cashless claim helpline."
          action={
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Register First Policy
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPolicies.map((policy) => (
            <InsurancePolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}

      {/* Educational Guide for Family Hospital Emergencies */}
      <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">
                How Cashless Hospitalization Works in India (Family Summary)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When someone is hospitalized, their family should head directly to the hospital’s{" "}
                <strong>TPA / Insurance Desk</strong>. By showing the <strong>Digital TPA Card</strong>{" "}
                or policy number, the hospital directly coordinates pre-authorization with the insurance company.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="rounded-lg bg-background/80 p-2.5 border">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                    1. 24-Hour Rule
                  </span>
                  In emergency admissions, inform the hospital TPA desk within 24 hours to secure cashless approval.
                </div>
                <div className="rounded-lg bg-background/80 p-2.5 border">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                    2. Zero Advance
                  </span>
                  Network hospitals cannot demand cash deposits for approved medical expenses under IRDAI guidelines.
                </div>
                <div className="rounded-lg bg-background/80 p-2.5 border">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                    3. Non-Medical Items
                  </span>
                  Only non-payable items (gloves, administrative charges, food) need to be paid in cash at discharge.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Policy Dialog */}
      <AddInsurancePolicyDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
};

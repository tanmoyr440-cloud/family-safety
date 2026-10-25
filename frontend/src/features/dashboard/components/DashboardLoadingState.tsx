import * as React from "react";
import { Card, CardContent, CardHeader } from "@/shared/ui/Card";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ShieldCheck, TrendingUp, CreditCard, Lock, Sparkles } from "lucide-react";

interface LoadingStep {
  message: string;
  icon: React.ElementType;
  progress: number;
}

const LOADING_STEPS: LoadingStep[] = [
  {
    message: "Connecting to secure safety net vault...",
    icon: Lock,
    progress: 22,
  },
  {
    message: "Auditing Groww portfolio & AMFI mutual fund NAVs...",
    icon: TrendingUp,
    progress: 48,
  },
  {
    message: "Checking monthly car loan EMI obligation status...",
    icon: CreditCard,
    progress: 74,
  },
  {
    message: "Verifying emergency alert delivery channels...",
    icon: ShieldCheck,
    progress: 90,
  },
  {
    message: "Finalizing safety telemetry...",
    icon: Sparkles,
    progress: 97,
  },
];

export const DashboardLoadingState: React.FC = () => {
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 600);

    return () => clearInterval(timer);
  }, []);

  const currentStep = LOADING_STEPS[stepIndex] ?? (LOADING_STEPS[0] as LoadingStep);
  const StepIcon = currentStep.icon;

  return (
    <div
      role="status"
      aria-label="Loading dashboard status"
      className="space-y-8 animate-in fade-in duration-300"
    >
      <span className="sr-only">
        Securing your safety net and loading telemetry data...
      </span>

      {/* Psychological Reassurance Scanner Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50/90 p-5 shadow-xs">
        {/* Shimmer overlay */}
        <div className="shimmer-wave absolute inset-0 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3.5">
            {/* Glowing radar shield */}
            <div className="relative flex items-center justify-center shrink-0">
              <div className="absolute h-11 w-11 rounded-full bg-blue-400/20 animate-radar pointer-events-none" />
              <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                <StepIcon className="h-5 w-5 animate-pulse" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  Checking Family Safety Net
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                  {currentStep.progress}%
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 transition-all duration-300">
                {currentStep.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 shrink-0 self-end sm:self-center">
            <Lock className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>256-Bit Encrypted Telemetry</span>
          </div>
        </div>

        {/* Stepped Progress Bar */}
        <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-blue-100/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-500 ease-out shadow-xs"
            style={{ width: `${currentStep.progress}%` }}
          />
        </div>
      </div>

      {/* Header Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg shimmer-wave" />
          <Skeleton className="h-4 w-80 max-w-full rounded shimmer-wave" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-24 rounded-lg shimmer-wave" />
          <Skeleton className="h-7 w-20 rounded-full shimmer-wave" />
        </div>
      </div>

      {/* Primary Check-in CTA Skeleton */}
      <section aria-label="Quick Check-in Skeleton">
        <div className="space-y-2">
          <Skeleton className="h-14 sm:h-16 w-full sm:w-64 rounded-2xl shimmer-wave bg-blue-100/60" />
          <Skeleton className="h-3 w-72 rounded shimmer-wave" />
        </div>
      </section>

      {/* Core Monitoring & Obligations Grid (Inactivity Ring + Next EMI Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Inactivity Ring Skeleton */}
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36 rounded shimmer-wave" />
              <Skeleton className="h-4 w-28 rounded shimmer-wave" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center sm:justify-start">
              {/* Circular Dial Skeleton */}
              <div className="relative flex items-center justify-center shrink-0">
                <Skeleton className="w-32 h-32 rounded-full shimmer-wave" />
              </div>
              <div className="space-y-2.5 w-full max-w-xs">
                <Skeleton className="h-5 w-40 rounded shimmer-wave" />
                <Skeleton className="h-3.5 w-56 rounded shimmer-wave" />
                <Skeleton className="h-3.5 w-48 rounded shimmer-wave" />
              </div>
            </div>
            {/* Warning stages */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <Skeleton className="h-10 rounded-lg shimmer-wave" />
              <Skeleton className="h-10 rounded-lg shimmer-wave" />
              <Skeleton className="h-10 rounded-lg shimmer-wave" />
            </div>
          </CardContent>
        </Card>

        {/* Next EMI Card Skeleton */}
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44 rounded shimmer-wave" />
              <Skeleton className="h-6 w-20 rounded-full shimmer-wave" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-32 rounded shimmer-wave" />
                <Skeleton className="h-3.5 w-48 rounded shimmer-wave" />
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-3 w-20 rounded shimmer-wave ml-auto" />
                <Skeleton className="h-4 w-28 rounded shimmer-wave ml-auto" />
              </div>
            </div>

            {/* Timeline Steps Skeleton */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-28 rounded shimmer-wave" />
                <Skeleton className="h-3.5 w-16 rounded shimmer-wave" />
              </div>
              <Skeleton className="h-12 w-full rounded-lg shimmer-wave" />
              <Skeleton className="h-12 w-full rounded-lg shimmer-wave" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial & Protection Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Portfolio Overview Skeleton */}
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded shimmer-wave" />
              <Skeleton className="h-5 w-24 rounded-full shimmer-wave" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-44 rounded shimmer-wave" />
              <Skeleton className="h-3.5 w-56 rounded shimmer-wave" />
            </div>
            {/* Asset split bar skeleton */}
            <Skeleton className="h-3 w-full rounded-full shimmer-wave" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-14 rounded-xl shimmer-wave" />
              <Skeleton className="h-14 rounded-xl shimmer-wave" />
            </div>
          </CardContent>
        </Card>

        {/* Protection Coverage Skeleton */}
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44 rounded shimmer-wave" />
              <Skeleton className="h-6 w-16 rounded-full shimmer-wave" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-28 rounded shimmer-wave" />
              <Skeleton className="h-3.5 w-60 rounded shimmer-wave" />
            </div>
            {/* 4 Pillars gauge skeleton */}
            <Skeleton className="h-3 w-full rounded-full shimmer-wave" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <Skeleton className="h-12 rounded-lg shimmer-wave" />
              <Skeleton className="h-12 rounded-lg shimmer-wave" />
              <Skeleton className="h-12 rounded-lg shimmer-wave" />
              <Skeleton className="h-12 rounded-lg shimmer-wave" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

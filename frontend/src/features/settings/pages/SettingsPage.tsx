import * as React from "react";
import { useSettingsData } from "../api/useSettingsData";
import { InactivityThresholdsCard } from "../components/InactivityThresholdsCard";
import { LoanGraceSettingsCard } from "../components/LoanGraceSettingsCard";
import { PauseMonitoringCard } from "../components/PauseMonitoringCard";
import { SecuritySettingsCard } from "../components/SecuritySettingsCard";
import { DataManagementCard } from "../components/DataManagementCard";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, RotateCcw } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useSettingsData();

  if (isLoading) {
    return (
      <div className="space-y-6" aria-label="Loading settings">
        <div>
          <Skeleton className="h-8 w-48 rounded-xl mb-2" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center space-y-4 max-w-lg mx-auto my-8"
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-bold text-red-950">Unable to Load Settings</h2>
          <p className="text-xs text-red-800 mt-1">
            {error instanceof Error ? error.message : "Failed to load monitor configuration."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Try Again
        </Button>
      </div>
    );
  }

  const { monitor, owner, loans } = data;
  const primaryLoan = loans[0];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings &amp; Preferences
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure inactivity alert intervals, loan grace delays, account security, and privacy.
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. Inactivity Alert Thresholds */}
        <InactivityThresholdsCard
          currentThresholdDays={monitor.threshold_days}
          currentWarningDays={monitor.warning_days}
        />

        {/* 2. Loan Grace Delay */}
        <LoanGraceSettingsCard
          loanId={primaryLoan?.id}
          currentGraceDays={primaryLoan?.grace_days}
          lenderName={primaryLoan?.lender}
        />

        {/* 3. Pause Inactivity Monitoring */}
        <PauseMonitoringCard pausedUntil={monitor.paused_until} />

        {/* 4. Security & MFA */}
        <SecuritySettingsCard mfaEnabled={owner.mfa_enabled} />

        {/* 5. Data Export & Account Deletion */}
        <DataManagementCard />
      </div>
    </div>
  );
};

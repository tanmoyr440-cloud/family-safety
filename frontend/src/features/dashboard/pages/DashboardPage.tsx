import * as React from "react";
import { useMonitorStatus } from "../api/useMonitorStatus";
import { useLoans } from "@/features/loans/api/useLoans";
import { useContacts } from "@/features/contacts/api/useContacts";
import { useCurrentUser } from "@/features/auth/api/useCurrentUser";
import { StatusHeader } from "../components/StatusHeader";
import { CheckInButton } from "../components/CheckInButton";
import { InactivityRing } from "../components/InactivityRing";
import { NextEmiCard } from "../components/NextEmiCard";
import { AttentionList } from "../components/AttentionList";
import { PausedBanner } from "../components/PausedBanner";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, RefreshCw } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const {
    data: monitor,
    isLoading: isMonitorLoading,
    isError: isMonitorError,
    error: monitorError,
    refetch: refetchMonitor,
  } = useMonitorStatus();

  const { data: loans, isLoading: isLoansLoading } = useLoans();
  const { data: contacts } = useContacts();
  const { data: user } = useCurrentUser();

  if (isMonitorLoading) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading dashboard">
        {/* Header Skeleton */}
        <div className="space-y-2 border-b border-slate-200 pb-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* Check-in CTA Skeleton */}
        <Skeleton className="h-16 w-full sm:w-64 rounded-2xl" />

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <span className="sr-only">Loading dashboard status...</span>
      </div>
    );
  }

  if (isMonitorError || !monitor) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 space-y-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-red-950">Unable to load safety net status</h2>
            <p className="text-sm text-red-800">
              {monitorError instanceof Error
                ? monitorError.message
                : "A network error occurred while retrieving your monitor data."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchMonitor()}
          className="gap-2 bg-white border-red-200 text-red-900 hover:bg-red-100"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </Button>
      </div>
    );
  }

  const primaryLoan = loans?.[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Paused state banner */}
      {monitor.status === "PAUSED" && <PausedBanner pausedUntil={monitor.paused_until} />}

      {/* Status Header */}
      <StatusHeader status={monitor} />

      {/* Primary Check-in Action (Prominent, Thumb-reachable) */}
      <section aria-label="Quick Check-in">
        <CheckInButton />
      </section>

      {/* Attention items & System Warnings */}
      <AttentionList status={monitor} contacts={contacts} mfaEnabled={user?.mfa_enabled} />

      {/* Grid: Inactivity Ring & Loan EMI Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <InactivityRing status={monitor} />

        {isLoansLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <NextEmiCard loan={primaryLoan} />
        )}
      </div>
    </div>
  );
};

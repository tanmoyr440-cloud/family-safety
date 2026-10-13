import * as React from "react";
import { useCheckIn } from "../api/useCheckIn";
import { CheckCircle2, RotateCw } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface CheckInButtonProps {
  className?: string;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({ className }) => {
  const [successNotice, setSuccessNotice] = React.useState(false);
  const { mutate: checkIn, isPending, isError, error } = useCheckIn();

  const handleCheckIn = () => {
    setSuccessNotice(false);
    checkIn(undefined, {
      onSuccess: () => {
        setSuccessNotice(true);
        setTimeout(() => setSuccessNotice(false), 4000);
      },
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={isPending}
        className={cn(
          "w-full sm:w-auto min-w-[240px] h-14 sm:h-16 px-8 rounded-2xl font-semibold text-base sm:text-lg text-white shadow-lg shadow-blue-500/25 transition-all duration-200",
          "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none",
          "flex items-center justify-center gap-3 focus:outline-none focus:ring-4 focus:ring-blue-500/30",
        )}
        aria-label="I'm okay, check in today"
      >
        {isPending ? (
          <>
            <RotateCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Checking in...</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span>I&apos;m okay, check in</span>
          </>
        )}
      </button>

      {successNotice && (
        <div
          role="status"
          className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 animate-in fade-in slide-in-from-top-1"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>Check-in recorded! Your 90-day inactivity clock has been reset.</span>
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
        >
          <span>
            {error instanceof Error
              ? error.message
              : "Unable to record check-in. Please try again."}
          </span>
          <button
            type="button"
            onClick={handleCheckIn}
            className="text-xs font-semibold text-red-700 hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

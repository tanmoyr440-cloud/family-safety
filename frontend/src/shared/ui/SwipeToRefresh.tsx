import * as React from "react";
import { ArrowDown, ArrowUp, Check, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";

export interface SwipeToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

export const SwipeToRefresh: React.FC<SwipeToRefreshProps> = ({
  children,
  onRefresh,
  threshold = 60,
  disabled = false,
  className,
}) => {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    queryClient = null;
  }

  const [pullDistance, setPullDistance] = React.useState(0);
  const [pullDirection, setPullDirection] = React.useState<"up" | "down" | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const canPullUpRef = React.useRef(false);
  const canPullDownRef = React.useRef(false);

  const handleRefresh = React.useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsSuccess(false);

    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(15);
      }
    } catch {
      // Haptics not available or denied
    }

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 650));
      const refreshTask = onRefresh
        ? Promise.resolve(onRefresh())
        : queryClient
          ? queryClient.refetchQueries({ type: "active" })
          : Promise.resolve();

      await Promise.all([refreshTask, minDelay]);
      setIsSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 750));
    } catch (err) {
      console.warn("Swipe refresh error:", err);
    } finally {
      setIsRefreshing(false);
      setIsSuccess(false);
      setPullDistance(0);
      setPullDirection(null);
    }
  }, [isRefreshing, onRefresh, queryClient]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshing) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Check if at the top or bottom of scroll boundaries
    canPullDownRef.current = scrollY <= 10;
    canPullUpRef.current = winHeight + scrollY >= docHeight - 25 || docHeight <= winHeight + 10;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || disabled || isRefreshing) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    const diffY = touchStartRef.current.y - touch.clientY;
    const diffX = touchStartRef.current.x - touch.clientX;

    // Ignore primarily horizontal gestures (e.g. carousels or swipe tabs)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      return;
    }

    // 1. Swipe Up gesture (pull upwards from bottom of page or anywhere on short viewports)
    if (diffY > 10 && canPullUpRef.current) {
      const dampenedDistance = Math.min(diffY * 0.5, threshold * 1.5);
      setPullDirection("up");
      setPullDistance(dampenedDistance);
    }
    // 2. Swipe Down gesture (pull downwards from top of page)
    else if (diffY < -10 && canPullDownRef.current) {
      const dampenedDistance = Math.min(-diffY * 0.5, threshold * 1.5);
      setPullDirection("down");
      setPullDistance(dampenedDistance);
    } else {
      setPullDistance(0);
      setPullDirection(null);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || disabled) return;
    touchStartRef.current = null;

    if (pullDistance >= threshold && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
      setPullDirection(null);
    }
  };

  const progressRatio = Math.min(pullDistance / threshold, 1);
  const isTriggerReady = pullDistance >= threshold;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={cn("relative min-h-full", className)}
    >
      {/* Top Pull-to-Refresh Indicator (Swipe Down) */}
      {pullDirection === "down" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            transform: `translate(-50%, ${isRefreshing || isSuccess ? 16 : Math.max(0, pullDistance - 10)}px)`,
            opacity: isRefreshing || isSuccess ? 1 : Math.max(0.3, progressRatio),
          }}
          className={cn(
            "fixed z-50 left-1/2 -translate-x-1/2 top-16 pointer-events-none select-none transition-transform duration-100 ease-out",
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-lg border",
            "bg-white/95 text-slate-800 border-slate-200/90 backdrop-blur-md text-xs font-semibold",
          )}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Refreshing live data...</span>
            </>
          ) : isSuccess ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700">Updated just now</span>
            </>
          ) : (
            <>
              <ArrowDown
                style={{ transform: `rotate(${isTriggerReady ? 180 : 0}deg)` }}
                className="h-4 w-4 text-blue-600 transition-transform duration-150"
              />
              <span>{isTriggerReady ? "Release to refresh" : "Pull down to refresh"}</span>
            </>
          )}
        </div>
      )}

      {/* Main Page Children Content */}
      {children}

      {/* Bottom Swipe Up to Refresh Floating Pill Indicator (Swipe Up) */}
      {(pullDirection === "up" || (isRefreshing && pullDirection !== "down") || (isSuccess && pullDirection !== "down")) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            transform: `translate(-50%, ${isRefreshing || isSuccess ? 0 : Math.max(-20, -pullDistance * 0.3)}px)`,
            opacity: isRefreshing || isSuccess ? 1 : Math.max(0.2, progressRatio),
            bottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.75rem))",
          }}
          className={cn(
            "fixed z-50 left-1/2 -translate-x-1/2 pointer-events-none select-none transition-all duration-150 ease-out",
            "flex items-center gap-2 px-4 py-2 rounded-full shadow-xl border",
            "bg-slate-900/95 text-white border-slate-700/80 backdrop-blur-md text-xs font-semibold shadow-slate-950/20",
          )}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              <span>Refreshing live data...</span>
            </>
          ) : isSuccess ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300">Updated just now</span>
            </>
          ) : (
            <>
              <ArrowUp
                style={{ transform: `rotate(${isTriggerReady ? 180 : 0}deg)` }}
                className="h-3.5 w-3.5 text-blue-400 transition-transform duration-150"
              />
              <span>{isTriggerReady ? "Release to refresh" : "Swipe up to refresh"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

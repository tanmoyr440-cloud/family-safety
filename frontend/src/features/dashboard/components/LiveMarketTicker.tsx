import * as React from "react";
import { Link } from "react-router-dom";
import { useStockWebSocket, type LiveStockTick } from "@/features/accounts/api/useStockWebSocket";
import { Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export const LiveMarketTicker: React.FC = () => {
  const { ticks, isConnected, flashStates } = useStockWebSocket(true);
  const stockList = React.useMemo(() => Object.values(ticks), [ticks]);

  if (stockList.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      {/* Header with Live Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Live Market Price Watch
          </h2>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors",
              isConnected
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
              )}
            />
            {isConnected ? "Live Stream (3s Ticks)" : "Connecting..."}
          </span>
        </div>

        <Link
          to="/accounts"
          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
        >
          <span>All Stocks</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Ticker Row */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
        {stockList.map((stock: LiveStockTick) => {
          const isPositive = stock.change >= 0;
          const flash = flashStates[stock.symbol];

          return (
            <div
              key={stock.symbol}
              className={cn(
                "shrink-0 min-w-[170px] sm:min-w-[190px] p-3 rounded-xl border transition-all duration-300",
                flash === "up"
                  ? "bg-emerald-50/90 border-emerald-300 shadow-sm scale-[1.02]"
                  : flash === "down"
                    ? "bg-red-50/90 border-red-300 shadow-sm scale-[1.02]"
                    : "bg-slate-50/70 border-slate-200/80 hover:border-slate-300",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-slate-900 tracking-tight truncate">
                  {stock.symbol}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
                    isPositive
                      ? "text-emerald-700 bg-emerald-100/70"
                      : "text-red-700 bg-red-100/70",
                  )}
                >
                  {isPositive ? (
                    <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                  )}
                  {isPositive ? "+" : ""}
                  {stock.change_pct.toFixed(2)}%
                </span>
              </div>

              <div className="text-[11px] text-muted-foreground truncate mt-0.5" title={stock.name}>
                {stock.name}
              </div>

              <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-slate-200/50">
                <span className="font-mono font-bold text-sm text-slate-900">
                  ₹{stock.price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    isPositive ? "text-emerald-600 font-medium" : "text-red-600 font-medium",
                  )}
                >
                  {isPositive ? "+" : ""}₹{stock.change.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

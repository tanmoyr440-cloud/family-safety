import * as React from "react";
import { Link } from "react-router-dom";
import type { PortfolioSummary } from "@/features/accounts/api/useMutualFunds";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Button } from "@/shared/ui/Button";
import { ArrowRight, Layers, PieChart, Sparkles, TrendingUp } from "lucide-react";

export interface PortfolioOverviewCardProps {
  summary?: PortfolioSummary | null;
  isLoading?: boolean;
}

export const PortfolioOverviewCard: React.FC<PortfolioOverviewCardProps> = ({
  summary,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="h-5 w-40 bg-slate-200 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
          <div className="h-3 w-full bg-slate-200 animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
            <div className="h-16 bg-slate-100 animate-pulse rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPaise = summary?.total_portfolio_value_paise ?? 0;
  const mfPaise = summary?.total_mf_value_paise ?? 0;
  const stockPaise = summary?.total_stock_value_paise ?? 0;
  const mfCount = summary?.mf_count ?? 0;
  const stockCount = summary?.stock_count ?? 0;
  const totalHoldings = mfCount + stockCount;

  const mfRatio = totalPaise > 0 ? Math.round((mfPaise / totalPaise) * 100) : 0;
  const stockRatio = totalPaise > 0 ? 100 - mfRatio : 0;

  const hasHoldings = totalHoldings > 0 || totalPaise > 0;

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Portfolio &amp; Holdings
            </CardTitle>
          </div>
          <Link
            to="/accounts"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <span>Manage</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {!hasHoldings ? (
            <div className="text-center py-6 space-y-3 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <PieChart className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">No portfolio synced yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Import your CAS statement or add mutual funds manually to track valuations and protect assets.
                </p>
              </div>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                <Link to="/accounts">Import Portfolio</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Total Valuation */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Valuation
                </span>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    <MoneyText paise={totalPaise} />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live AMFI/NSE Sync
                  </span>
                </div>
              </div>

              {/* Asset Allocation Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Mutual Funds ({mfRatio}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Stocks &amp; Equities ({stockRatio}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex" role="progressbar" aria-label="Asset Allocation">
                  <div
                    style={{ width: `${mfRatio}%` }}
                    className="bg-emerald-500 transition-all duration-500 h-full"
                    title={`Mutual Funds: ${mfRatio}%`}
                  />
                  <div
                    style={{ width: `${stockRatio}%` }}
                    className="bg-blue-500 transition-all duration-500 h-full"
                    title={`Stocks: ${stockRatio}%`}
                  />
                </div>
              </div>

              {/* Metric Chips */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3 text-emerald-600" />
                    Mutual Funds
                  </span>
                  <MoneyText paise={mfPaise} className="font-bold text-sm text-slate-900 block" />
                  <span className="text-[10px] text-slate-500 block font-medium">
                    {mfCount} {mfCount === 1 ? "Scheme" : "Schemes"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-1">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-blue-600" />
                    Stocks &amp; Equities
                  </span>
                  <MoneyText paise={stockPaise} className="font-bold text-sm text-slate-900 block" />
                  <span className="text-[10px] text-slate-500 block font-medium">
                    {stockCount} {stockCount === 1 ? "Holding" : "Holdings"}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </div>

      {hasHoldings && (
        <div className="px-5 sm:px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Total {totalHoldings} Assets Tracked</span>
          <Link to="/accounts" className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
            View Folios &amp; CAS
          </Link>
        </div>
      )}
    </Card>
  );
};

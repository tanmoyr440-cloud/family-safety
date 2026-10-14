import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { MoneyText } from "@/shared/ui/MoneyText";
import { formatDateIST } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { AddMutualFundDialog } from "./AddMutualFundDialog";
import { ImportCasDialog } from "./ImportCasDialog";
import {
  useClearAllMutualFundHoldings,
  useDeleteMutualFundHolding,
  useMutualFundHoldings,
  usePortfolioSummary,
  type MutualFundHolding,
} from "../api/useMutualFunds";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileUp,
  Info,
  PieChart,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";

export interface HoldingsSnapshotCardProps {
  lastSyncedAt?: string | null;
  isConnected?: boolean;
}

export const HoldingsSnapshotCard: React.FC<HoldingsSnapshotCardProps> = ({
  lastSyncedAt,
}) => {
  const [activeTab, setActiveTab] = React.useState<"mutual_funds" | "stocks">("mutual_funds");
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isCasOpen, setIsCasOpen] = React.useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = React.useState(false);
  const [holdingToDelete, setHoldingToDelete] = React.useState<MutualFundHolding | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const { data: allHoldings, isLoading: isLoadingHoldings } = useMutualFundHoldings();
  const { data: summary, isLoading: isLoadingSummary } = usePortfolioSummary();
  const { mutateAsync: deleteHolding, isPending: isDeleting } = useDeleteMutualFundHolding();
  const { mutateAsync: clearAllHoldings, isPending: isClearing } = useClearAllMutualFundHoldings();

  // Separate Mutual Funds from Stocks
  const mfHoldings = (allHoldings || []).filter(
    (h) => (h.asset_type || "MUTUAL_FUND") === "MUTUAL_FUND",
  );
  const stockHoldings = (allHoldings || []).filter((h) => h.asset_type === "STOCK");

  const hasHoldings = Boolean(allHoldings && allHoldings.length > 0);
  const totalMfPaise = mfHoldings.reduce((acc, h) => acc + (h.value_paise || 0), 0);
  const totalStockPaise = stockHoldings.reduce((acc, h) => acc + (h.value_paise || 0), 0);
  const totalPortfolioPaise = totalMfPaise + totalStockPaise;

  // Monthly Refresh Freshness check
  const isStale = Boolean(summary?.is_stale || (summary?.days_since_update != null && summary.days_since_update >= 30));
  const daysSinceUpdate = summary?.days_since_update;

  const handleConfirmDelete = async () => {
    if (!holdingToDelete) return;
    try {
      setErrorMessage(null);
      await deleteHolding(holdingToDelete.id);
      setSuccessMessage(`Removed "${holdingToDelete.scheme_name}" from portfolio.`);
      setHoldingToDelete(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to delete holding. Please try again.";
      setErrorMessage(msg);
    }
  };

  const handleConfirmClearAll = async () => {
    try {
      setErrorMessage(null);
      await clearAllHoldings();
      setSuccessMessage("All portfolio holdings snapshot data cleared successfully.");
      setIsClearAllOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to clear holdings snapshot. Please try again.";
      setErrorMessage(msg);
    }
  };

  return (
    <>
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Portfolio Holdings Snapshot
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mutual funds with live NAVs from official SEBI / AMFI public registry & demat stocks from NSE / BSE
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lastSyncedAt && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                as of {formatDateIST(lastSyncedAt)}
              </span>
            )}
            {hasHoldings && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setErrorMessage(null);
                  setIsClearAllOpen(true);
                }}
                disabled={isClearing || isDeleting}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCasOpen(true)}
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs h-8"
            >
              <FileUp className="h-3.5 w-3.5 mr-1 text-indigo-600" />
              Import CAS Statement
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Mutual Fund
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Notifications */}
          {successMessage && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>{successMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                aria-label="Dismiss success message"
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss error message"
                className="text-red-700 hover:text-red-900 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Monthly Update Reminder Banner */}
          {hasHoldings && isStale && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 gap-3">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-semibold text-amber-900 text-sm">Monthly Portfolio Refresh Due</div>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    {summary?.reminder_message ||
                      `Your portfolio holdings snapshot was last updated ${daysSinceUpdate || 30} days ago. Upload your latest monthly CAS statement to sync current units, stock holdings, and valuations.`}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCasOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs h-8 shadow-xs"
              >
                <FileUp className="h-3.5 w-3.5 mr-1.5" />
                Upload Latest CAS Statement
              </Button>
            </div>
          )}

          {hasHoldings && !isStale && daysSinceUpdate != null && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>
                  Portfolio snapshot up to date (updated {daysSinceUpdate === 0 ? "today" : `${daysSinceUpdate} days ago`}).
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 hidden sm:inline flex items-center gap-1">
                <Clock className="h-3 w-3 inline" />
                Next monthly refresh recommended in ~{Math.max(1, 30 - daysSinceUpdate)} days
              </span>
            </div>
          )}

          {/* General Information Banner */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              This snapshot provides family contacts visibility of which mutual funds, AMCs, and stocks you own.{" "}
              <strong>Emergency contacts cannot liquidate or withdraw assets.</strong>
            </p>
          </div>

          {/* Portfolio Metric Strip */}
          {hasHoldings && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  Total Portfolio Valuation
                </span>
                <div className="text-lg font-bold text-slate-900">
                  <MoneyText paise={totalPortfolioPaise} />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-600 flex items-center gap-1">
                  <PieChart className="h-3 w-3" />
                  Mutual Funds ({mfHoldings.length})
                </span>
                <div className="text-base font-semibold text-slate-800">
                  <MoneyText paise={totalMfPaise} />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-600 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Stocks & Equities ({stockHoldings.length})
                </span>
                <div className="text-base font-semibold text-slate-800">
                  <MoneyText paise={totalStockPaise} />
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation: Mutual Funds vs Stocks */}
          {hasHoldings && (
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("mutual_funds")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeTab === "mutual_funds"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                <PieChart className="h-3.5 w-3.5" />
                Mutual Funds
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    activeTab === "mutual_funds"
                      ? "bg-blue-800 text-blue-100"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {mfHoldings.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("stocks")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeTab === "stocks"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Stocks & Equities
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    activeTab === "stocks"
                      ? "bg-indigo-800 text-indigo-100"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {stockHoldings.length}
                </span>
              </button>
            </div>
          )}

          {/* Tab 1: Mutual Funds Table */}
          {isLoadingHoldings ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Loading valuations from official registries...
            </div>
          ) : hasHoldings && activeTab === "mutual_funds" ? (
            mfHoldings.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th scope="col" className="px-4 py-3">
                          Scheme & Fund House
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Units
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Official AMFI NAV
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Live Valuation
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {mfHoldings.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.scheme_name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{item.fund_house}</span>
                              {item.folio_masked && (
                                <span className="font-mono text-slate-500">
                                  Folio: {item.folio_masked}
                                </span>
                              )}
                              {item.isin && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  {item.isin}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-800">
                            {item.units}
                          </td>
                          <td className="px-4 py-3">
                            {item.latest_nav ? (
                              <div className="space-y-0.5">
                                <span className="font-mono font-medium text-slate-800">
                                  ₹{item.latest_nav.toFixed(2)}
                                </span>
                                {item.nav_date && (
                                  <div className="text-[10px] text-slate-500">
                                    {item.nav_date}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Syncing...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            <MoneyText
                              paise={item.value_paise}
                              className="font-semibold text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setHoldingToDelete(item);
                              }}
                              disabled={isDeleting || isClearing}
                              aria-label={`Remove ${item.scheme_name}`}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {totalMfPaise > 0 && (
                      <tfoot className="bg-slate-50/80 border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-2.5 font-semibold text-slate-800 text-xs">
                            Total Mutual Fund Valuation ({mfHoldings.length} schemes)
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                            <MoneyText paise={totalMfPaise} />
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
                <p className="text-xs font-semibold text-slate-700">No mutual fund holdings in snapshot</p>
                <p className="text-[11px] text-slate-500">
                  Upload your CAMS/KFintech CAS statement or click &quot;Add Mutual Fund&quot; to register schemes.
                </p>
              </div>
            )
          ) : hasHoldings && activeTab === "stocks" ? (
            stockHoldings.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th scope="col" className="px-4 py-3">
                          Stock / Company Name
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Shares
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Live Market Price
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Current Market Value
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {stockHoldings.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.scheme_name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span className="font-medium text-indigo-700">{item.fund_house}</span>
                              {item.isin && (
                                <span className="font-mono text-[10px] text-slate-500">
                                  ISIN: {item.isin}
                                </span>
                              )}
                              {item.folio_masked && (
                                <span className="font-mono text-slate-500">
                                  Demat: {item.folio_masked}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-800">
                            {item.units}
                          </td>
                          <td className="px-4 py-3">
                            {item.latest_nav ? (
                              <div className="space-y-0.5">
                                <span className="font-mono font-medium text-slate-800">
                                  ₹{item.latest_nav.toFixed(2)}
                                </span>
                                {item.nav_date && (
                                  <div className="text-[10px] text-slate-500">
                                    {item.nav_date}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Syncing live quote...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            <MoneyText
                              paise={item.value_paise}
                              className="font-semibold text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setHoldingToDelete(item);
                              }}
                              disabled={isDeleting || isClearing}
                              aria-label={`Remove ${item.scheme_name}`}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {totalStockPaise > 0 && (
                      <tfoot className="bg-slate-50/80 border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-2.5 font-semibold text-slate-800 text-xs">
                            Total Stocks & Equities Valuation ({stockHoldings.length} stocks)
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                            <MoneyText paise={totalStockPaise} />
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
                <p className="text-xs font-semibold text-slate-700">No stock holdings in this snapshot</p>
                <p className="text-[11px] text-slate-500">
                  Upload your CDSL or NSDL CAS statement to automatically import your demat equity shares.
                </p>
              </div>
            )
          ) : (
            /* Empty State when no holdings exist */
            <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  No mutual fund holdings added yet
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Auto-import your entire portfolio of mutual funds and stocks in one click with your CAS statement, or search official SEBI-registered funds manually.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCasOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <FileUp className="h-4 w-4 mr-1.5" />
                  Auto-Import CAS Statement
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddOpen(true)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Manually
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddMutualFundDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      <ImportCasDialog open={isCasOpen} onOpenChange={setIsCasOpen} />

      {/* Confirmation Dialog for Clearing All Snapshot Data */}
      <ConfirmDialog
        open={isClearAllOpen}
        onOpenChange={setIsClearAllOpen}
        title="Clear Portfolio Holdings Snapshot?"
        description={`This will delete all ${allHoldings?.length || 0} mutual fund holdings from your snapshot data. You can re-import them anytime by uploading your updated CAS statement.`}
        confirmLabel="Clear All Data"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isClearing}
        onConfirm={handleConfirmClearAll}
      />

      {/* Confirmation Dialog for Removing Individual Holding */}
      <ConfirmDialog
        open={Boolean(holdingToDelete)}
        onOpenChange={(open) => !open && setHoldingToDelete(null)}
        title={holdingToDelete?.asset_type === "STOCK" ? "Remove Stock Holding?" : "Remove Mutual Fund Holding?"}
        description={`Are you sure you want to remove "${holdingToDelete?.scheme_name}" from your portfolio holdings snapshot?`}
        confirmLabel="Remove Holding"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};

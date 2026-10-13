import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { MoneyText } from "@/shared/ui/MoneyText";
import { formatDateIST } from "@/shared/lib/dates";
import { AddMutualFundDialog } from "./AddMutualFundDialog";
import { ImportCasDialog } from "./ImportCasDialog";
import { useDeleteMutualFundHolding, useMutualFundHoldings } from "../api/useMutualFunds";
import { FileUp, Info, PieChart, Plus, Trash2, TrendingUp } from "lucide-react";

export interface HoldingsSnapshotCardProps {
  lastSyncedAt?: string | null;
  isConnected?: boolean;
}

export const HoldingsSnapshotCard: React.FC<HoldingsSnapshotCardProps> = ({
  lastSyncedAt,
}) => {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isCasOpen, setIsCasOpen] = React.useState(false);
  const { data: mfHoldings, isLoading: isLoadingMf } = useMutualFundHoldings();
  const { mutate: deleteHolding, isPending: isDeleting } = useDeleteMutualFundHolding();

  const hasHoldings = Boolean(mfHoldings && mfHoldings.length > 0);

  const totalPaise = (mfHoldings || []).reduce((acc, h) => acc + (h.value_paise || 0), 0);

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
                Mutual funds with live NAVs from official SEBI / AMFI public registry
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lastSyncedAt && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                as of {formatDateIST(lastSyncedAt)}
              </span>
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
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              This snapshot gives trusted family contacts awareness of which fund houses and
              schemes you have investments with.{" "}
              <strong>Emergency contacts cannot withdraw or liquidate funds.</strong>
            </p>
          </div>

          {isLoadingMf ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Loading mutual fund valuations from SEBI/AMFI...
            </div>
          ) : hasHoldings ? (
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
                        Latest NAV
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
                    {mfHoldings?.map((item) => (
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
                            onClick={() => deleteHolding(item.id)}
                            disabled={isDeleting}
                            aria-label={`Remove ${item.scheme_name}`}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totalPaise > 0 && (
                    <tfoot className="bg-slate-50/80 border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5 font-semibold text-slate-800 text-xs">
                          Total Mutual Fund Portfolio
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 text-sm">
                          <MoneyText paise={totalPaise} />
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  No mutual fund holdings added yet
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Auto-import your entire portfolio in one click with your CAMS/KFintech CAS statement, or search official SEBI-registered funds manually.
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
    </>
  );
};

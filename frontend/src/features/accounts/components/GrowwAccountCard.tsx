import * as React from "react";
import type { GrowwAccount } from "../api/useGrowwAccount";
import { useRefreshGrowwHoldings } from "../api/useRefreshGrowwHoldings";
import { useUpdateGrowwAccount } from "../api/useUpdateGrowwAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { StatusPill } from "@/shared/ui/StatusPill";
import { Button } from "@/shared/ui/Button";
import { formatDateIST } from "@/shared/lib/dates";
import { maskAccount } from "@/shared/lib/masks";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Key,
  Layers,
  Link2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

export interface GrowwAccountCardProps {
  account: GrowwAccount;
}

export const GrowwAccountCard: React.FC<GrowwAccountCardProps> = ({ account }) => {
  const [isConfiguring, setIsConfiguring] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [apiSecret, setApiSecret] = React.useState("");

  const {
    mutate: refreshHoldings,
    isPending: isRefreshing,
    isSuccess: isRefreshSuccess,
    error: refreshError,
  } = useRefreshGrowwHoldings();

  const {
    mutate: updateAccount,
    isPending: isUpdating,
    error: updateError,
  } = useUpdateGrowwAccount();

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccount(
      {
        api_key: apiKey.trim() || null,
        api_secret: apiSecret.trim() || null,
      },
      {
        onSuccess: () => {
          setIsConfiguring(false);
          setApiKey("");
          setApiSecret("");
        },
      },
    );
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Groww Investment Account
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stocks & Mutual Funds activity tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusPill
            tone={account.connected ? "success" : "neutral"}
            label={account.connected ? "Connected" : "Disconnected"}
          />
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Account metrics & metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-100 text-xs">
          <div>
            <span className="text-muted-foreground block mb-1">Masked Client ID</span>
            <span className="font-mono font-semibold text-slate-800 text-sm">
              {account.masked_account ? maskAccount(account.masked_account) : "—"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1">Holdings Tracked</span>
            <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {account.holdings_count} assets
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1">Last Synced</span>
            <span className="font-medium text-slate-700 text-xs">
              {account.last_synced_at ? formatDateIST(account.last_synced_at) : "Never"}
            </span>
          </div>
        </div>

        {/* Reconnect / Informational callout if disconnected */}
        {!account.connected && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-start gap-2">
              <Activity className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-amber-950">Integration is optional</p>
                <p className="text-amber-800 leading-relaxed mt-0.5">
                  Groww gives no automatic last-login signal. If disconnected or expired, your
                  manual check-ins remain the primary activity signal. You can reconnect read-only
                  credentials or keep using check-ins.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback states */}
        {refreshError && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{refreshError.message || "Failed to refresh portfolio holdings."}</p>
          </div>
        )}

        {isRefreshSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Holdings snapshot refreshed successfully.</span>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsConfiguring(!isConfiguring)}
          >
            <Key className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            {account.connected ? "Update Credentials" : "Connect Groww API"}
          </Button>

          {account.connected && (
            <Button
              type="button"
              variant="default"
              size="sm"
              isLoading={isRefreshing}
              onClick={() => refreshHoldings()}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Refresh Holdings
            </Button>
          )}
        </div>

        {/* Credentials Form (Collapsible) */}
        {isConfiguring && (
          <form
            onSubmit={handleSaveCredentials}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3.5 pt-4 text-xs"
          >
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Link2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Groww Read-Only API Credentials
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Enter your read-only API Key and Secret. Family Safety Net will only inspect portfolio
              holdings and will never have withdrawal or trade access.
            </p>

            {updateError && <p className="text-red-600 text-xs">{updateError.message}</p>}

            <div>
              <label htmlFor="groww-api-key" className="block font-medium text-slate-700 mb-1">
                API Key
              </label>
              <input
                id="groww-api-key"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="groww_api_key_..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="groww-api-secret" className="block font-medium text-slate-700 mb-1">
                API Secret
              </label>
              <input
                id="groww-api-secret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfiguring(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isUpdating}>
                Save Settings
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  useAddMutualFundHolding,
  useMutualFundNav,
  useSearchMutualFunds,
  type MutualFundScheme,
} from "../api/useMutualFunds";
import { Button } from "@/shared/ui/Button";
import { MoneyText } from "@/shared/ui/MoneyText";
import { cn } from "@/shared/lib/utils";
import { Check, Loader2, Plus, Search, ShieldCheck, X } from "lucide-react";

export interface AddMutualFundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddMutualFundDialog: React.FC<AddMutualFundDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedScheme, setSelectedScheme] = React.useState<MutualFundScheme | null>(null);
  const [units, setUnits] = React.useState<string>("100");
  const [folio, setFolio] = React.useState<string>("");

  const { data: searchResults, isFetching: isSearching } = useSearchMutualFunds(searchTerm);
  const { data: navData, isFetching: isLoadingNav } = useMutualFundNav(
    selectedScheme?.scheme_code ?? null,
  );
  const { mutate: addHolding, isPending: isAdding, error } = useAddMutualFundHolding();

  // Reset state when closed
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedScheme(null);
      setUnits("100");
      setFolio("");
    }
  }, [open]);

  const unitsNum = parseFloat(units) || 0;
  const currentNav = navData?.nav ?? 0;
  const estimatedPaise = Math.round(unitsNum * currentNav * 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheme || unitsNum <= 0) return;

    addHolding(
      {
        scheme_code: selectedScheme.scheme_code,
        units: unitsNum,
        folio_number: folio.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4",
            "border border-slate-200 bg-white p-6 shadow-xl duration-200 sm:rounded-2xl max-h-[90vh] overflow-y-auto",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Add SEBI Mutual Fund
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-slate-500">
                Search official SEBI/AMFI registered schemes. NAV and valuations are fetched live.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 text-xs rounded-lg bg-red-50 border border-red-200 text-red-800">
              {error.message || "Failed to add mutual fund holding. Please try again."}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Scheme search */}
            <div className="space-y-1.5">
              <label
                htmlFor="scheme-search"
                className="block text-xs font-semibold text-slate-700"
              >
                Search Scheme Name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="scheme-search"
                  type="text"
                  placeholder="e.g. Parag Parikh Flexi Cap, UTI Nifty 50, SBI Bluechip..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-emerald-600 animate-spin" />
                )}
              </div>

              {/* Search dropdown results */}
              {searchResults && searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1 divide-y divide-slate-100 text-xs">
                  {searchResults.map((s) => (
                    <button
                      type="button"
                      key={s.scheme_code}
                      onClick={() => {
                        setSelectedScheme(s);
                        setSearchTerm(s.scheme_name);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center justify-between",
                        selectedScheme?.scheme_code === s.scheme_code &&
                          "bg-emerald-100 font-semibold text-emerald-900",
                      )}
                    >
                      <span className="truncate pr-2">{s.scheme_name}</span>
                      {selectedScheme?.scheme_code === s.scheme_code && (
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Scheme Details Badge */}
            {selectedScheme && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <div className="font-semibold text-slate-900">{selectedScheme.scheme_name}</div>
                {isLoadingNav ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Fetching latest SEBI/AMFI NAV...
                  </div>
                ) : navData ? (
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/60">
                    <div>
                      <span className="text-slate-500">Fund House:</span>{" "}
                      <strong>{navData.fund_house}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Latest NAV:</span>{" "}
                      <strong>₹{navData.nav.toFixed(4)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">NAV Date:</span>{" "}
                      <span>{navData.nav_date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Scheme Code:</span>{" "}
                      <span className="font-mono">{navData.scheme_code}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 2: Units input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="mf-units" className="block text-xs font-semibold text-slate-700">
                  Number of Units
                </label>
                <input
                  id="mf-units"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="e.g. 150.25"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mf-folio" className="block text-xs font-semibold text-slate-700">
                  Folio Number (Optional)
                </label>
                <input
                  id="mf-folio"
                  type="text"
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  placeholder="e.g. 1029384756"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Real-time valuation estimation */}
            {selectedScheme && currentNav > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-600">Calculated Valuation (Units × NAV):</span>
                <span className="font-bold text-slate-900 text-sm">
                  <MoneyText paise={estimatedPaise} />
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                isLoading={isAdding}
                disabled={!selectedScheme || unitsNum <= 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add to Safety Net
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

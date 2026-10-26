import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useUpdateMutualFundHolding, type MutualFundHolding } from "../api/useMutualFunds";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/utils";
import { AlertCircle, FileText, Loader2, Save, ShieldCheck, X } from "lucide-react";

export interface EditHoldingFolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: MutualFundHolding | null;
}

export const EditHoldingFolioDialog: React.FC<EditHoldingFolioDialogProps> = ({
  open,
  onOpenChange,
  holding,
}) => {
  const [folioNumber, setFolioNumber] = React.useState("");
  const [units, setUnits] = React.useState<string>("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const { mutate: updateHolding, isPending, error: apiError } = useUpdateMutualFundHolding();

  const isStock =
    holding?.asset_type === "STOCK" ||
    Boolean(holding?.fund_house?.includes("Demat")) ||
    Boolean(holding?.isin?.startsWith("INE") || holding?.isin?.startsWith("IN9"));

  React.useEffect(() => {
    if (holding && open) {
      setFolioNumber("");
      setUnits(holding.units != null ? String(holding.units) : "");
      setLocalError(null);
    }
  }, [holding, open]);

  if (!holding) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanFolio = folioNumber.trim();
    if (cleanFolio && cleanFolio.length < 3) {
      setLocalError("Folio or Demat number must have at least 3 characters.");
      return;
    }

    const parsedUnits = units.trim() ? parseFloat(units.trim()) : undefined;
    if (parsedUnits !== undefined && (isNaN(parsedUnits) || parsedUnits <= 0)) {
      setLocalError("Units must be a positive number.");
      return;
    }

    const payload: { folio_number?: string; units?: number } = {};
    if (cleanFolio) {
      payload.folio_number = cleanFolio;
    }
    if (parsedUnits !== undefined) {
      payload.units = parsedUnits;
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    updateHolding(
      {
        id: holding.id,
        data: payload,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const errorMessage = localError || apiError?.message;

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
                <FileText className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                {isStock ? "Edit Demat Details" : "Edit Folio Details"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-slate-500">
                Update account and folio numbers for {holding.scheme_name}.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Holding summary info */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-900 text-xs">{holding.scheme_name}</div>
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
              <span>{holding.fund_house}</span>
              {holding.isin && <span className="font-mono">ISIN: {holding.isin}</span>}
              {holding.folio_masked && (
                <span className="font-mono text-slate-700">
                  Current Masked: {holding.folio_masked}
                </span>
              )}
            </div>
          </div>

          {holding.has_unmasked_folio === false && (
            <div
              role="alert"
              className="p-3 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="leading-relaxed">
                <span className="font-semibold block">Full unmasked folio missing for alerts</span>
                Enter your genuine folio or demat account number below. This ensures your emergency contacts will see the unmasked number in emails & SMS to claim with CAMS / KFintech.
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 text-xs rounded-xl bg-red-50 border border-red-200 text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-holding-folio" className="text-xs font-semibold text-slate-800">
                {isStock ? "Demat / Account Number" : "Folio Number"}
              </label>
              <input
                id="edit-holding-folio"
                type="text"
                value={folioNumber}
                onChange={(e) => setFolioNumber(e.target.value)}
                placeholder={holding.folio_masked ? `e.g. Full number replacing ${holding.folio_masked}` : "e.g. 10892345/01"}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-muted-foreground block">
                Leave blank to keep existing. Will be masked in UI; sent unmasked to emergency contacts.
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-holding-units" className="text-xs font-semibold text-slate-800">
                Units Held
              </label>
              <input
                id="edit-holding-units"
                type="number"
                step="any"
                min="0.0001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g. 100.5"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed">
                Folio numbers are kept masked in the dashboard UI for privacy. When inactivity or emergency alerts are sent to your verified contacts, full unmasked folio details are included so they can submit claims with RTAs (CAMS/KFintech).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

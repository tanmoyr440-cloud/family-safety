import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useImportCas, type CasImportResponse } from "../api/useImportCas";
import { Button } from "@/shared/ui/Button";
import { MoneyText } from "@/shared/ui/MoneyText";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, FileUp, FileText, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";

export interface ImportCasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportCasDialog: React.FC<ImportCasDialogProps> = ({ open, onOpenChange }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [password, setPassword] = React.useState<string>("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [importSummary, setImportSummary] = React.useState<CasImportResponse | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { mutate: importCas, isPending, error, reset } = useImportCas();

  // Reset state on modal open/close
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setPassword("");
      setImportSummary(null);
      setIsDragging(false);
      reset();
    }
  }, [open, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    importCas(
      { file, password: password.trim() || undefined },
      {
        onSuccess: (data) => {
          setImportSummary(data);
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
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <FileUp className="h-5 w-5 text-indigo-600" />
                Auto-Import CAS Statement
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-slate-500">
                Upload your CDSL, NSDL, CAMS, or KFintech Consolidated Account Statement PDF to instantly sync your portfolio.
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

          {/* Success summary view */}
          {importSummary ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-semibold text-emerald-950 text-base">
                  Portfolio Synced Successfully
                </h4>
                <p className="text-xs text-emerald-800">
                  Imported <span className="font-bold">{importSummary.imported_count}</span> holdings and folios.
                  Valuations updated with live SEBI/AMFI feeds.
                </p>
                {importSummary.total_value_paise > 0 && (
                  <div className="pt-2 text-sm font-medium text-emerald-900">
                    Total Statement Value:{" "}
                    <MoneyText
                      paise={importSummary.total_value_paise}
                      className="font-bold text-emerald-700"
                    />
                  </div>
                )}
              </div>

              {importSummary.holdings.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1.5 text-xs">
                  {importSummary.holdings.map((h) => (
                    <div
                      key={h.id}
                      className="p-2 bg-white rounded border border-slate-100 flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <p className="font-medium text-slate-800 truncate">{h.scheme_name}</p>
                        <p className="text-[10px] text-slate-500">
                          {h.units.toFixed(3)} units • {h.folio_masked || "No Folio"}
                        </p>
                      </div>
                      <MoneyText paise={h.value_paise} className="font-semibold text-slate-900 shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Done
              </Button>
            </div>
          ) : (
            /* Upload & password form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-xs rounded-lg bg-red-50 border border-red-200 text-red-800">
                  {error.message || "Failed to process CAS statement. Please check the PDF or password."}
                </div>
              )}

              {/* PDF Dropzone */}
              <div
                role="button"
                tabIndex={0}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-indigo-500 bg-indigo-50/50"
                    : file
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-300 hover:border-indigo-400 bg-slate-50/50",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-xs">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileUp className="h-8 w-8 text-slate-400 mx-auto" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Click to upload or drag & drop PDF
                      </p>
                      <p className="text-xs text-slate-500">
                        CDSL, NSDL, CAMS, or KFintech statement (.pdf)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cas-password"
                  className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  PDF Password (if protected)
                </label>
                <input
                  id="cas-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="PAN (e.g. ABCDE1234F) or PAN + DOB (DDMMYYYY)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-tight">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    CDSL/NSDL statements are typically protected by PAN in UPPERCASE or PAN + DOB (DDMMYYYY). CAMS/KFintech use PAN in UPPERCASE. Decrypted strictly in-memory and never stored.
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!file || isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Parsing Statement...
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4" />
                      Import Holdings
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

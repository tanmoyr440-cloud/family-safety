import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useDeleteAccount } from "../api/useDeleteAccount";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, AlertTriangle, X } from "lucide-react";

export interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ isOpen, onClose }) => {
  const [confirmText, setConfirmText] = React.useState("");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { mutate: deleteAccount, isPending } = useDeleteAccount();

  const isConfirmed = confirmText.trim() === "DELETE MY ACCOUNT";

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    setServerError(null);
    deleteAccount(undefined, {
      onError: (err: Error) => {
        setServerError(err.message || "Failed to delete account. Please try again.");
      },
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmText("");
      setServerError(null);
      onClose();
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-red-200 bg-background p-6 shadow-xl duration-200 sm:rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-slate-900">
                  Delete Account Permanently
                </DialogPrimitive.Title>
                <p className="text-xs text-red-600 font-medium mt-0.5">
                  This action is irreversible
                </p>
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="text-xs text-slate-600 leading-relaxed space-y-2">
            <span>
              All registered monitors, loan records, contacts, and encrypted documents will be
              permanently purged from our servers.
            </span>
          </DialogPrimitive.Description>

          {serverError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-900"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
              <p>{serverError}</p>
            </div>
          )}

          <form onSubmit={handleDelete} className="space-y-4 pt-1">
            <div>
              <label
                htmlFor="confirm-delete-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Type{" "}
                <span className="font-mono text-red-700 bg-red-50 px-1 py-0.5 rounded">
                  DELETE MY ACCOUNT
                </span>{" "}
                to confirm:
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="w-full font-mono text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                isLoading={isPending}
                disabled={!isConfirmed}
              >
                Delete Everything
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

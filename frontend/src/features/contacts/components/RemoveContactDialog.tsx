import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/shared/ui/Button";
import type { Contact } from "../api/useContacts";
import { AlertTriangle, Trash2, X } from "lucide-react";

export interface RemoveContactDialogProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isRemoving?: boolean;
  totalVerifiedContacts: number;
}

export const RemoveContactDialog: React.FC<RemoveContactDialogProps> = ({
  contact,
  isOpen,
  onClose,
  onConfirm,
  isRemoving = false,
  totalVerifiedContacts,
}) => {
  if (!contact) return null;

  const isLastVerified = contact.consent === "VERIFIED" && totalVerifiedContacts <= 1;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-xl duration-200 sm:rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              {isLastVerified ? (
                <div className="rounded-full bg-red-100 p-1.5 text-red-600">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
              ) : (
                <div className="rounded-full bg-slate-100 p-1.5 text-slate-600">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-slate-900">
                {isLastVerified ? "Remove last verified contact?" : `Remove ${contact.name}?`}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description asChild>
            <div className="space-y-3 text-sm text-slate-600">
              {isLastVerified ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
                  <p className="font-semibold text-sm mb-1 text-red-950">
                    Warning: Emergency alerts will not reach anyone!
                  </p>
                  <p className="text-xs text-red-800 leading-relaxed">
                    This is your <strong>only verified contact</strong>. If you remove them, no one
                    will be alerted if your investment activity stops for 90 days or if a monthly
                    loan EMI is missed.
                  </p>
                </div>
              ) : (
                <p>
                  Are you sure you want to remove <strong>{contact.name}</strong> from your
                  emergency safety net? They will no longer receive updates or emergency alerts.
                </p>
              )}
            </div>
          </DialogPrimitive.Description>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isRemoving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isRemoving}
              onClick={async () => {
                await onConfirm();
              }}
            >
              {isLastVerified ? "Remove anyway" : "Remove Contact"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

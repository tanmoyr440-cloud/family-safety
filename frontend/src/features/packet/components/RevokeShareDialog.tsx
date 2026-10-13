import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/shared/ui/Button";
import type { PacketShare } from "../api/usePacketShares";
import { AlertTriangle, X } from "lucide-react";

export interface RevokeShareDialogProps {
  share: PacketShare | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isRevoking?: boolean;
}

export const RevokeShareDialog: React.FC<RevokeShareDialogProps> = ({
  share,
  isOpen,
  onClose,
  onConfirm,
  isRevoking = false,
}) => {
  if (!share) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-xl duration-200 sm:rounded-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-red-100 p-1.5 text-red-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-slate-900">
                Revoke packet access?
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
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Are you sure you want to revoke the emergency packet link issued to{" "}
                <strong className="text-slate-900">{share.contact_name}</strong>?
              </p>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800">
                The link and token will be invalidated immediately. They will not be able to view
                emergency instructions or documents until a new link is issued.
              </div>
            </div>
          </DialogPrimitive.Description>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isRevoking}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isRevoking}
              onClick={async () => {
                await onConfirm();
              }}
            >
              Revoke Access
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

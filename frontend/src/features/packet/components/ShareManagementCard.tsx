import * as React from "react";
import { usePacketShares, type PacketShare } from "../api/usePacketShares";
import { useCreatePacketShare } from "../api/useCreatePacketShare";
import { useRevokePacketShare } from "../api/useRevokePacketShare";
import { useContacts } from "@/features/contacts/api/useContacts";
import { RevokeShareDialog } from "./RevokeShareDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { StatusPill } from "@/shared/ui/StatusPill";
import { Button } from "@/shared/ui/Button";
import { formatDateIST } from "@/shared/lib/dates";
import { Skeleton } from "@/shared/ui/Skeleton";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  Share2,
  Trash2,
  User,
} from "lucide-react";

export const ShareManagementCard: React.FC = () => {
  const { data: shares, isLoading, refetch } = usePacketShares();
  const { data: contacts } = useContacts();

  const { mutate: createShare, isPending: isCreating } = useCreatePacketShare();
  const { mutate: revokeShare, isPending: isRevoking } = useRevokePacketShare();

  const [shareToRevoke, setShareToRevoke] = React.useState<PacketShare | null>(null);
  const [isRevokeOpen, setIsRevokeOpen] = React.useState(false);

  const [selectedContactId, setSelectedContactId] = React.useState("");
  const [newlyCreatedShare, setNewlyCreatedShare] = React.useState<PacketShare | null>(null);
  const [copiedShareId, setCopiedShareId] = React.useState<string | null>(null);
  const [copiedNewShare, setCopiedNewShare] = React.useState(false);

  React.useEffect(() => {
    if (!selectedContactId && contacts && contacts.length > 0) {
      setSelectedContactId(contacts[0]!.id);
    }
  }, [contacts, selectedContactId]);

  const handleCreateShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) return;
    createShare(selectedContactId, {
      onSuccess: (data) => {
        setNewlyCreatedShare(data);
        refetch();
      },
    });
  };

  const handleCopyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareId(id);
      setTimeout(() => setCopiedShareId(null), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyNewShare = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedNewShare(true);
      setTimeout(() => setCopiedNewShare(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleConfirmRevoke = () => {
    if (!shareToRevoke) return;
    revokeShare(shareToRevoke.id, {
      onSuccess: () => {
        setIsRevokeOpen(false);
        setShareToRevoke(null);
        refetch();
      },
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Active Emergency Packet Shares
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Secure links created for trusted contacts to view emergency instructions
            </p>
          </div>
        </div>

        {/* Generate share for contact form */}
        <form onSubmit={handleCreateShare} className="flex items-center gap-2">
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Select contact for share link"
          >
            {contacts && contacts.length > 0 ? (
              contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.relation})
                </option>
              ))
            ) : (
              <option value="">No contacts available</option>
            )}
          </select>
          <Button
            type="submit"
            size="sm"
            isLoading={isCreating}
            disabled={!selectedContactId || !contacts || contacts.length === 0}
          >
            <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Create Link
          </Button>
        </form>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Newly created share banner */}
        {newlyCreatedShare && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
                <div>
                  <h4 className="font-semibold text-emerald-950 text-xs sm:text-sm">
                    Emergency Packet Link Created for {newlyCreatedShare.contact_name}
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Share this link with {newlyCreatedShare.contact_name}. They can open it to verify with OTP and view instructions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewlyCreatedShare(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1 text-xs font-semibold"
                aria-label="Dismiss banner"
              >
                Dismiss
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/p/${newlyCreatedShare.token}`}
                className="text-xs font-mono bg-white border border-emerald-300 rounded-lg px-3 py-2 text-slate-800 flex-1 truncate select-all focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 flex-1 sm:flex-none text-xs"
                  onClick={() =>
                    handleCopyNewShare(`${window.location.origin}/p/${newlyCreatedShare.token}`)
                  }
                >
                  {copiedNewShare ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" aria-hidden="true" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white flex-1 sm:flex-none text-xs"
                  onClick={() =>
                    window.open(
                      `${window.location.origin}/p/${newlyCreatedShare.token}`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  Open Packet
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3" aria-label="Loading shares">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        )}

        {!isLoading && (!shares || shares.length === 0) && (
          <div className="text-center py-8 text-xs text-muted-foreground bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-6">
            <LinkIcon className="h-8 w-8 text-slate-400 mx-auto mb-2" aria-hidden="true" />
            <p className="font-semibold text-slate-800">No active packet shares</p>
            <p className="mt-1">
              Links are automatically generated when inactivity alerts trigger, or you can create a
              test link above.
            </p>
          </div>
        )}

        {!isLoading && shares && shares.length > 0 && (
          <div className="space-y-3">
            {shares.map((share) => {
              const isExpired = new Date(share.expires_at) < new Date();
              const shareUrl = `${window.location.origin}/p/${share.token}`;
              return (
                <div
                  key={share.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-slate-900 text-sm">
                        {share.contact_name}
                      </span>
                      {share.revoked ? (
                        <StatusPill tone="critical" label="Revoked" />
                      ) : isExpired ? (
                        <StatusPill tone="neutral" label="Expired" />
                      ) : (
                        <StatusPill tone="success" label="Active Link" />
                      )}
                    </div>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-mono text-[11px] flex items-center gap-1.5 hover:underline"
                    >
                      <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      /p/{share.token.slice(0, 8)}...
                    </a>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        Created {formatDateIST(share.created_at)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        Expires {formatDateIST(share.expires_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {!share.revoked && !isExpired && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-slate-700 hover:text-slate-900 border-slate-200 text-xs"
                          onClick={() => handleCopyLink(share.id, shareUrl)}
                        >
                          {copiedShareId === share.id ? (
                            <>
                              <Check
                                className="h-3.5 w-3.5 mr-1 text-emerald-600"
                                aria-hidden="true"
                              />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                              Copy Link
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 text-xs"
                          onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                          Open
                        </Button>
                      </>
                    )}
                    {!share.revoked && !isExpired && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs"
                        onClick={() => {
                          setShareToRevoke(share);
                          setIsRevokeOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                        Revoke Access
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <RevokeShareDialog
        share={shareToRevoke}
        isOpen={isRevokeOpen}
        onClose={() => {
          setIsRevokeOpen(false);
          setShareToRevoke(null);
        }}
        onConfirm={handleConfirmRevoke}
        isRevoking={isRevoking}
      />
    </Card>
  );
};

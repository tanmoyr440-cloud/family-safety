import * as React from "react";
import type { Contact } from "../api/useContacts";
import { useResendConsentOtp } from "../api/useResendConsentOtp";
import { Card, CardContent } from "@/shared/ui/Card";
import { StatusPill } from "@/shared/ui/StatusPill";
import { Button } from "@/shared/ui/Button";
import { maskPhone } from "@/shared/lib/masks";
import { formatDateIST } from "@/shared/lib/dates";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  Mail,
  Phone,
  Send,
  Trash2,
  UserX,
} from "lucide-react";

export interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onRemove: (contact: Contact) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onEdit, onRemove }) => {
  const [copied, setCopied] = React.useState(false);
  const {
    mutate: resendOtp,
    isPending: isResending,
    isSuccess: isResentSuccess,
  } = useResendConsentOtp();

  const handleCopyLink = () => {
    const url = `${window.location.origin}/verify-contact/${contact.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConsentTone = (consent: string): "success" | "warning" | "critical" => {
    switch (consent) {
      case "VERIFIED":
        return "success";
      case "PENDING":
        return "warning";
      case "OPTED_OUT":
      default:
        return "critical";
    }
  };

  const getConsentLabel = (consent: string): string => {
    switch (consent) {
      case "VERIFIED":
        return "Verified";
      case "PENDING":
        return "Consent Pending";
      case "OPTED_OUT":
        return "Opted Out";
      default:
        return consent;
    }
  };

  return (
    <Card className="overflow-hidden border-slate-200 hover:border-slate-300 transition-all shadow-sm">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header row: Name, Relation, Priority, Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                {contact.name}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                {contact.relation}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Priority #{contact.priority}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill
              tone={getConsentTone(contact.consent)}
              label={getConsentLabel(contact.consent)}
            />
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-mono font-medium text-slate-800">{maskPhone(contact.phone)}</span>
          </div>

          <div className="flex items-center gap-2 truncate">
            <Mail className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate text-slate-700">{contact.email}</span>
          </div>

          {contact.consent === "VERIFIED" && contact.consent_verified_at && (
            <div className="flex items-center gap-2 text-emerald-700 col-span-full">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Consent verified on {formatDateIST(contact.consent_verified_at)}</span>
            </div>
          )}

          {contact.last_delivery && (
            <div className="flex items-center gap-2 text-slate-500 col-span-full">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Last delivery status: {contact.last_delivery}</span>
            </div>
          )}
        </div>

        {/* Consent specific banners and actions */}
        {contact.consent === "PENDING" && (
          <div className="flex flex-col gap-3 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">Waiting for contact consent</p>
                <p className="text-amber-800">
                  {isResentSuccess
                    ? "Verification OTP sent to contact's phone and email!"
                    : "This contact must enter the OTP sent to their phone/email before receiving emergency alerts."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-amber-200/60 flex-wrap">
              <a
                href={`/verify-contact/${contact.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Open Verify Page
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" aria-hidden="true" />
                    Link Copied!
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
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                isLoading={isResending}
                onClick={() => resendOtp(contact.id)}
              >
                <Send className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Resend OTP
              </Button>
            </div>
          </div>
        )}

        {contact.consent === "OPTED_OUT" && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            <UserX className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Contact opted out:</strong> This person declined to receive emergency
              notifications. They will not be alerted. You may edit their phone or remove them.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(contact)}
            className="text-slate-600 hover:text-slate-900"
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(contact)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

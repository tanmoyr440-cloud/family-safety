import * as React from "react";
import { Link } from "react-router-dom";
import type { Contact } from "@/features/contacts/api/useContacts";
import type { MonitorStatus } from "../api/useMonitorStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { AlertTriangle, ChevronRight, ShieldAlert, UserCheck, Users } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface AttentionListProps {
  status: MonitorStatus;
  contacts?: Contact[];
  mfaEnabled?: boolean;
  className?: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
  linkText: string;
  to: string;
  tone: "warning" | "danger" | "neutral";
  icon: React.ReactNode;
}

export const AttentionList: React.FC<AttentionListProps> = ({
  status,
  contacts,
  mfaEnabled,
  className,
}) => {
  const items: AttentionItem[] = [];

  // 1. Scheduler watchdog check
  if (!status.scheduler_healthy) {
    items.push({
      id: "scheduler_unhealthy",
      title: "Scheduler heartbeat delayed",
      description:
        "Background watchdog is not updating. Automated daily evaluations may be delayed.",
      linkText: "View system status",
      to: "/settings",
      tone: "danger",
      icon: <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />,
    });
  }

  // 2. Verified contacts check
  const verifiedContacts = contacts?.filter((c) => c.consent === "VERIFIED") || [];
  if (contacts && verifiedContacts.length === 0) {
    items.push({
      id: "no_verified_contacts",
      title: "No verified emergency contacts",
      description:
        "Alerts cannot reach your family until at least one parent confirms consent via OTP.",
      linkText: "Verify contacts",
      to: "/contacts",
      tone: "danger",
      icon: <Users className="h-4 w-4 text-red-600" aria-hidden="true" />,
    });
  } else {
    const pendingContacts = contacts?.filter((c) => c.consent === "PENDING") || [];
    if (pendingContacts.length > 0) {
      items.push({
        id: "pending_contacts",
        title: `${pendingContacts.length} contact pending OTP verification`,
        description: "Waiting for recipient to confirm consent so alerts can be delivered.",
        linkText: "Manage contacts",
        to: "/contacts",
        tone: "warning",
        icon: <UserCheck className="h-4 w-4 text-amber-600" aria-hidden="true" />,
      });
    }
  }

  // 3. MFA disabled check
  if (mfaEnabled === false) {
    items.push({
      id: "mfa_off",
      title: "Two-factor authentication not enabled",
      description: "Add an authenticator app to protect your emergency settings and contact list.",
      linkText: "Enable MFA",
      to: "/mfa/enroll",
      tone: "neutral",
      icon: <AlertTriangle className="h-4 w-4 text-slate-500" aria-hidden="true" />,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-amber-200 bg-amber-50/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
          Attention Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border transition-colors",
              item.tone === "danger"
                ? "bg-red-50/50 border-red-200 text-red-950"
                : item.tone === "warning"
                  ? "bg-amber-50/50 border-amber-200 text-amber-950"
                  : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                <p className="text-xs text-slate-600">{item.description}</p>
              </div>
            </div>

            <Link
              to={item.to}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline shrink-0 self-end sm:self-center"
            >
              <span>{item.linkText}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

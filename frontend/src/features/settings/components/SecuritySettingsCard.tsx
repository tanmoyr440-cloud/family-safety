import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { StatusPill } from "@/shared/ui/StatusPill";
import { Button } from "@/shared/ui/Button";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

export interface SecuritySettingsCardProps {
  mfaEnabled?: boolean;
}

export const SecuritySettingsCard: React.FC<SecuritySettingsCardProps> = ({
  mfaEnabled = false,
}) => {
  return (
    <Card className="border-border shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Account Security</CardTitle>
            <CardDescription className="text-xs">
              Manage multi-factor authentication (MFA) and account credentials.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="flex items-start gap-3">
            {mfaEnabled ? (
              <ShieldCheck
                className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  Two-Factor Authentication (TOTP)
                </span>
                <StatusPill
                  tone={mfaEnabled ? "success" : "warning"}
                  label={mfaEnabled ? "Enabled" : "Disabled"}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {mfaEnabled
                  ? "Your account requires an authenticator code on each sign-in."
                  : "Protect your emergency data against credential compromise by enabling TOTP."}
              </p>
            </div>
          </div>

          {!mfaEnabled && (
            <Link to="/mfa/enroll" className="shrink-0">
              <Button size="sm">Enable MFA</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mfaVerifySchema, type MfaVerifyFormData } from "../schemas/authSchemas";
import { useMfaEnroll } from "../api/useMfaEnroll";
import { useMfaVerify } from "../api/useMfaVerify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { StatusPill } from "@/shared/ui/StatusPill";
import { CheckCircle2, Copy, KeyRound, ShieldCheck } from "lucide-react";

export interface MfaEnrollCardProps {
  onEnrolled?: () => void;
}

export const MfaEnrollCard: React.FC<MfaEnrollCardProps> = ({ onEnrolled }) => {
  const [copied, setCopied] = React.useState(false);
  const [enrollData, setEnrollData] = React.useState<{
    secret: string;
    otpauth_url: string;
  } | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const { mutate: enroll, isPending: isEnrolling } = useMfaEnroll();
  const { mutate: verify, isPending: isVerifying } = useMfaVerify();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MfaVerifyFormData>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: { code: "" },
  });

  const handleStartEnroll = () => {
    setServerError(null);
    enroll(undefined, {
      onSuccess: (data) => {
        setEnrollData(data);
      },
      onError: () => {
        setServerError("Failed to initialize two-factor enrollment. Please try again.");
      },
    });
  };

  const handleCopySecret = async () => {
    if (!enrollData?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(true);
    }
  };

  const onVerifySubmit = (formData: MfaVerifyFormData) => {
    setServerError(null);
    verify(
      { code: formData.code },
      {
        onSuccess: () => {
          setIsSuccess(true);
          reset();
          if (onEnrolled) {
            onEnrolled();
          }
        },
        onError: () => {
          setServerError(
            "Invalid verification code. Please check your authenticator and try again.",
          );
        },
      },
    );
  };

  if (isSuccess) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-950">Two-Factor Authentication Active</CardTitle>
            <StatusPill tone="success" label="MFA Enabled" />
          </div>
          <CardDescription className="text-emerald-800">
            Your account is now protected with time-based one-time passwords (TOTP).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <p>
              When signing in, you will be prompted to enter the 6-digit code from your
              authenticator app.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden="true" />
            Two-Factor Authentication (MFA)
          </CardTitle>
          <StatusPill tone="neutral" label="Recommended" />
        </div>
        <CardDescription>
          Protect your emergency safety net with an authenticator app (Google Authenticator, Authy,
          1Password).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {serverError && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-200"
          >
            {serverError}
          </div>
        )}

        {!enrollData ? (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Enabling MFA ensures only you can configure safety triggers, manage family contacts,
              or pause monitors.
            </p>
            <Button onClick={handleStartEnroll} disabled={isEnrolling}>
              {isEnrolling ? "Setting up..." : "Set up Two-Factor Authentication"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Step 1: Add key to your authenticator app
              </h4>
              <p className="text-xs text-slate-600">
                In your authenticator app, choose &ldquo;Add account manually&rdquo; and enter the
                setup key below:
              </p>

              <div className="flex items-center gap-2">
                <code
                  data-testid="mfa-secret-key"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tracking-wider text-slate-900 select-all"
                >
                  {enrollData.secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecret}
                  className="gap-1.5 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              {enrollData.otpauth_url && (
                <div className="pt-1">
                  <a
                    href={enrollData.otpauth_url}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Open directly in authenticator app (mobile only)
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onVerifySubmit)} className="space-y-4" noValidate>
              <h4 className="text-sm font-semibold text-slate-900">
                Step 2: Enter the 6-digit confirmation code
              </h4>
              <div className="space-y-1">
                <label
                  htmlFor="mfa-verify-code"
                  className="block text-sm font-medium text-slate-700"
                >
                  Verification code
                </label>
                <input
                  id="mfa-verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  disabled={isVerifying}
                  aria-invalid={errors.code ? "true" : "false"}
                  aria-describedby={errors.code ? "mfa-verify-code-error" : undefined}
                  className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-lg tracking-widest text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                  placeholder="123456"
                  {...register("code")}
                />
                {errors.code && (
                  <p id="mfa-verify-code-error" className="text-xs text-red-600">
                    {errors.code.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isVerifying}>
                  {isVerifying ? "Verifying..." : "Verify & Enable MFA"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEnrollData(null)}
                  disabled={isVerifying}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

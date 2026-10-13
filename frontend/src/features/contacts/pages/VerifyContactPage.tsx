import * as React from "react";
import { useParams } from "react-router-dom";
import { usePublicVerifyContact } from "../api/usePublicVerifyContact";
import { usePublicOptOutContact } from "../api/usePublicOptOutContact";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck, UserX } from "lucide-react";

export interface VerifyContactPageProps {
  tokenOverride?: string;
}

export const VerifyContactPage: React.FC<VerifyContactPageProps> = ({ tokenOverride }) => {
  const params = useParams<{ token: string }>();
  const token = tokenOverride || params.token || "tok_default_123";
  const [otp, setOtp] = React.useState("");
  const [isOptingOutConfirm, setIsOptingOutConfirm] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "verified" | "opted_out">("idle");

  const {
    mutate: verifyContact,
    isPending: isVerifying,
    error: verifyError,
  } = usePublicVerifyContact();

  const {
    mutate: optOutContact,
    isPending: isOptingOut,
    error: optOutError,
  } = usePublicOptOutContact();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !otp.trim()) return;

    verifyContact(
      { token, otp: otp.trim() },
      {
        onSuccess: () => {
          setStatus("verified");
        },
      },
    );
  };

  const handleOptOut = () => {
    if (!token) return;
    optOutContact(
      { token },
      {
        onSuccess: () => {
          setStatus("opted_out");
          setIsOptingOutConfirm(false);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Calm logo / Brand */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 mb-2">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Family Safety Net</h1>
          <p className="text-xs text-muted-foreground">Emergency Contact Verification</p>
        </div>

        {/* Verification Success State */}
        {status === "verified" && (
          <Card className="border-emerald-200 bg-white shadow-sm text-center">
            <CardContent className="pt-8 pb-8 px-6 space-y-4">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Contact details verified</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Thank you! You are now confirmed as a trusted emergency contact. You will only
                receive an SMS and email if your family member has no investment activity for 90
                days or misses an EMI.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Opted Out State */}
        {status === "opted_out" && (
          <Card className="border-slate-200 bg-white shadow-sm text-center">
            <CardContent className="pt-8 pb-8 px-6 space-y-4">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-slate-100 text-slate-600 mx-auto">
                <UserX className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">You have opted out</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                You have successfully declined to be an emergency contact. You will not receive any
                emergency alerts from Family Safety Net.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Form State */}
        {status === "idle" && (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 text-center sm:text-left">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Confirm your contact consent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Plain language explanation in two sentences */}
              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                You were added as a trusted emergency contact on Family Safety Net. We will only
                contact you if your family member is inactive for an extended period or misses a
                critical payment.
              </div>

              {verifyError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
                >
                  <AlertCircle
                    className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p>
                    {verifyError.message ||
                      "Invalid or expired verification code. Please check and try again."}
                  </p>
                </div>
              )}

              {optOutError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
                >
                  <AlertCircle
                    className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p>{optOutError.message || "Failed to process opt-out request."}</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="otp-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Enter the 6-digit OTP sent to your phone
                  </label>
                  <div className="relative">
                    <KeyRound
                      className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full pl-9 pr-3 py-2 text-base tracking-widest font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Check your SMS messages for the code from Family Safety Net.
                  </p>
                  <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-2.5 flex items-center justify-between">
                    <span>
                      Local testing code: <strong className="font-mono text-xs font-bold text-amber-950">123456</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtp("123456")}
                      className="text-[11px] font-semibold text-amber-800 underline hover:text-amber-950"
                    >
                      Fill 123456
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isVerifying}
                  disabled={otp.length < 4}
                >
                  Confirm Consent
                </Button>
              </form>

              {/* Opt-out section */}
              <div className="pt-4 border-t border-slate-100 text-center">
                {!isOptingOutConfirm ? (
                  <button
                    type="button"
                    onClick={() => setIsOptingOutConfirm(true)}
                    className="text-xs text-slate-500 hover:text-red-600 underline transition-colors"
                  >
                    I do not wish to be an emergency contact (Opt out)
                  </button>
                ) : (
                  <div className="space-y-2 p-3 rounded-lg bg-red-50/50 border border-red-100 text-left">
                    <p className="text-xs text-red-900 font-medium">
                      Are you sure you want to decline?
                    </p>
                    <p className="text-[11px] text-red-700">
                      You will not receive any emergency notifications.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        isLoading={isOptingOut}
                        onClick={handleOptOut}
                      >
                        Confirm Opt-Out
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsOptingOutConfirm(false)}
                        disabled={isOptingOut}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

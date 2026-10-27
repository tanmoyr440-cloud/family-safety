import * as React from "react";
import { useSendPublicPacketOtp } from "../api/useSendPublicPacketOtp";
import { useVerifyPublicPacketOtp } from "../api/useVerifyPublicPacketOtp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, Lock, ShieldCheck, Smartphone } from "lucide-react";

export interface PublicPacketOtpPromptProps {
  token: string;
  ownerName: string;
  recipientPhoneMasked: string;
  onVerified: (sessionToken: string) => void;
}

export const PublicPacketOtpPrompt: React.FC<PublicPacketOtpPromptProps> = ({
  token,
  ownerName,
  recipientPhoneMasked,
  onVerified,
}) => {
  const [codeSent, setCodeSent] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { mutate: sendOtp, isPending: isSending } = useSendPublicPacketOtp(token);
  const { mutate: verifyOtp, isPending: isVerifying } = useVerifyPublicPacketOtp(token);

  const handleSendCode = () => {
    setErrorMessage(null);
    sendOtp(undefined, {
      onSuccess: () => {
        setCodeSent(true);
      },
      onError: (err: Error) => {
        setErrorMessage(
          err.message || "Unable to send verification code. Please wait a moment and try again.",
        );
      },
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setErrorMessage(null);
    verifyOtp(otp.trim(), {
      onSuccess: (data) => {
        onVerified(data.session_token);
      },
      onError: (err: Error) => {
        if (
          err.message.toLowerCase().includes("locked") ||
          (err as { code?: string }).code === "OTP_LOCKED_OUT"
        ) {
          setErrorMessage(
            "Too many failed attempts. For your security, access is temporarily locked for 15 minutes. Please try again later.",
          );
        } else {
          setErrorMessage("The verification code is incorrect. Please check and try again.");
        }
      },
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm max-w-lg mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
          Emergency Guidance for {ownerName}'s Family
        </CardTitle>
        <CardDescription className="text-xs text-slate-600 mt-1">
          {ownerName} configured you as their trusted emergency contact. This information is private
          and encrypted.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 p-6 pt-0">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        )}

        {!codeSent ? (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Smartphone className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>Verify Your Phone Number</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To confirm your identity before unlocking emergency financial instructions, we will
                send a 6-digit one-time code by SMS to your phone:
              </p>
              <p className="font-mono font-medium text-slate-900 text-sm">{recipientPhoneMasked}</p>
            </div>

            <Button
              type="button"
              className="w-full py-2.5"
              onClick={handleSendCode}
              isLoading={isSending}
            >
              Send me a code
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-slate-900">
                Code sent to {recipientPhoneMasked}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Enter the 6-digit code delivered to your phone:
              </p>
            </div>

            <div>
              <label htmlFor="packet-otp-input" className="sr-only">
                One-Time Verification Code
              </label>
              <input
                id="packet-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full text-center tracking-widest font-mono text-2xl font-bold rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full py-2.5"
              isLoading={isVerifying}
              disabled={otp.length !== 6}
            >
              View Emergency Packet
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isSending || isVerifying}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                Didn't receive code? Send again
              </button>
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span>Private and confidential. Never shared with unverified parties.</span>
        </div>
      </CardContent>
    </Card>
  );
};

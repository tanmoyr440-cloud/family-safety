import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useSendPublicPacketOtp } from "../api/useSendPublicPacketOtp";
import { useVerifyPublicPacketOtp } from "../api/useVerifyPublicPacketOtp";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, Clock } from "lucide-react";

export interface SessionExpiredModalProps {
  token: string;
  isOpen: boolean;
  onReverified: (newSessionToken: string) => void;
  maskedPhone?: string;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  token,
  isOpen,
  onReverified,
  maskedPhone,
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
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    setErrorMessage(null);
    verifyOtp(otp.trim(), {
      onSuccess: (data) => {
        onReverified(data.session_token);
        setOtp("");
        setCodeSent(false);
      },
      onError: (err: Error) => {
        if (
          err.message.toLowerCase().includes("locked") ||
          (err as { code?: string }).code === "OTP_LOCKED_OUT"
        ) {
          setErrorMessage("Too many failed attempts. Access is temporarily locked for 15 minutes.");
        } else {
          setErrorMessage("The verification code is incorrect. Please check and try again.");
        }
      },
    });
  };

  return (
    <DialogPrimitive.Root open={isOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-xl duration-200 sm:rounded-2xl">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-slate-900">
                Session Expired
              </DialogPrimitive.Title>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify identity to resume viewing
              </p>
            </div>
          </div>

          <DialogPrimitive.Description className="text-xs text-slate-600 leading-relaxed">
            For security, emergency packet sessions expire automatically after 15 minutes of
            activity. You can renew your session without leaving this page.
          </DialogPrimitive.Description>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{errorMessage}</p>
            </div>
          )}

          {!codeSent ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-700">
                A new security code will be sent to your phone{" "}
                {maskedPhone ? `(${maskedPhone})` : ""}.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={handleSendCode}
                isLoading={isSending}
              >
                Send Verification Code
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4 pt-2">
              <div>
                <label
                  htmlFor="session-otp-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Enter 6-digit Code
                </label>
                <input
                  id="session-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full text-center tracking-widest font-mono text-lg rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={isSending || isVerifying}
                  className="w-1/2"
                >
                  Resend Code
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="w-1/2"
                  isLoading={isVerifying}
                  disabled={otp.length !== 6}
                >
                  Continue Reading
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

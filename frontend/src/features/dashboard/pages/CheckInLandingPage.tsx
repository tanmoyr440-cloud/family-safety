import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useMagicLinkCheckIn } from "../api/useMagicLinkCheckIn";
import { Button } from "@/shared/ui/Button";

export const CheckInLandingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { mutate, isPending, isSuccess, isError, error } = useMagicLinkCheckIn();
  const calledRef = React.useRef(false);

  React.useEffect(() => {
    if (token && !calledRef.current) {
      calledRef.current = true;
      mutate(token);
    }
  }, [token, mutate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-4">
          <Shield className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-800">
          Family Safety Net
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10 text-center">
          {(!token || isPending) && (
            <div
              role="status"
              aria-label="Verifying check-in"
              className="py-8 flex flex-col items-center justify-center space-y-4"
            >
              <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" aria-hidden="true" />
              <h1 className="text-xl font-bold text-slate-900">Recording your check-in...</h1>
              <p className="text-sm text-slate-600">
                Please wait while we verify your secure link and reset your timer.
              </p>
            </div>
          )}

          {isSuccess && (
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Thanks, you&apos;re checked in.</h1>
              <p className="text-sm text-slate-600">
                Your 90-day clock has been reset. Your family will not receive any inactivity
                alerts.
              </p>
              <div className="pt-4 w-full">
                <Button asChild className="w-full">
                  <Link to="/login">Sign in to your account</Link>
                </Button>
              </div>
            </div>
          )}

          {isError && (
            <div role="alert" className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertCircle className="h-8 w-8" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">This link has expired</h1>
              <p className="text-sm text-slate-600">
                {error instanceof Error && error.message
                  ? error.message
                  : "This check-in link has expired or has already been used. Please log in to check in manually."}
              </p>
              <div className="pt-4 w-full">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">Sign in to your account</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

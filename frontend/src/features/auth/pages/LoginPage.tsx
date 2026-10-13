import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import { useCurrentUser } from "../api/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Shield } from "lucide-react";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/";

  const { data: user } = useCurrentUser();

  // If already authenticated, forward directly
  React.useEffect(() => {
    if (user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, navigate, returnTo]);

  const handleLoginSuccess = (mfaRequired: boolean) => {
    if (!mfaRequired) {
      navigate(returnTo, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-4 shadow-sm">
          <Shield className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in to Family Safety Net
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Emergency monitoring for your investments and loan commitments
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <CardTitle>Account Login</CardTitle>
            <CardDescription>
              Enter your account credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm onSuccess={handleLoginSuccess} />

            <div className="mt-6 border-t border-slate-200 pt-4 text-center">
              <p className="text-xs text-slate-600">
                Don&apos;t have an account?{" "}
                <Link
                  to={`/register${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
                  className="font-semibold text-blue-600 hover:text-blue-500 hover:underline"
                >
                  Create one now
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

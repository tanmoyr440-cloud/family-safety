import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { RegisterForm } from "../components/RegisterForm";
import { useCurrentUser } from "../api/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Shield } from "lucide-react";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/";

  const { data: user } = useCurrentUser();

  React.useEffect(() => {
    if (user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, navigate, returnTo]);

  const handleRegisterSuccess = () => {
    navigate(returnTo, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-4 shadow-sm">
          <Shield className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Your Safety Net</h1>
        <p className="mt-1 text-sm text-slate-500">
          Protect your family with automated safety alerts and emergency instructions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              We only notify your family when inactive for 90 days or if your EMI is missed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm onSuccess={handleRegisterSuccess} />

            <div className="mt-6 border-t border-slate-200 pt-4 text-center">
              <p className="text-xs text-slate-600">
                Already have an account?{" "}
                <Link
                  to={`/login${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
                  className="font-semibold text-blue-600 hover:text-blue-500 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

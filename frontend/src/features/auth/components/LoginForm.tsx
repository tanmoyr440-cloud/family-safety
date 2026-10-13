import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "../schemas/authSchemas";
import { useLogin } from "../api/useLogin";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, Lock, Mail, ShieldCheck } from "lucide-react";

export interface LoginFormProps {
  onSuccess: (mfaRequired: boolean) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [showMfaInput, setShowMfaInput] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { mutate: login, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      mfa_code: "",
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setServerError(null);
    login(
      {
        email: data.email,
        password: data.password,
        mfa_code: data.mfa_code || null,
      },
      {
        onSuccess: (res) => {
          if (res.mfa_required) {
            setShowMfaInput(true);
            onSuccess(true);
          } else {
            onSuccess(false);
          }
        },
        onError: () => {
          // Never reveal whether email or password was wrong
          setServerError("Invalid email or password. Please verify your credentials.");
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
          Email address
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            disabled={isPending}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
            placeholder="you@example.com"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p id="login-email-error" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            disabled={isPending}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
            placeholder="••••••••"
            {...register("password")}
          />
        </div>
        {errors.password && (
          <p id="login-password-error" className="text-xs text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      {showMfaInput && (
        <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <label htmlFor="login-mfa" className="block text-sm font-medium text-blue-950">
            Two-factor code
          </label>
          <div className="relative">
            <ShieldCheck
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600"
              aria-hidden="true"
            />
            <input
              id="login-mfa"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              disabled={isPending}
              aria-invalid={errors.mfa_code ? "true" : "false"}
              aria-describedby={errors.mfa_code ? "login-mfa-error" : undefined}
              className="w-full rounded-lg border border-blue-300 bg-white py-2 pl-9 pr-3 text-sm font-mono tracking-widest text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
              placeholder="000000"
              {...register("mfa_code")}
            />
          </div>
          {errors.mfa_code ? (
            <p id="login-mfa-error" className="text-xs text-red-600">
              {errors.mfa_code.message}
            </p>
          ) : (
            <p className="text-xs text-blue-700">
              Enter the 6-digit code from your authenticator app
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in..." : showMfaInput ? "Verify & Sign In" : "Sign In"}
      </Button>
    </form>
  );
};

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormData } from "../schemas/authSchemas";
import { useRegister } from "../api/useRegister";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, Lock, Mail, Phone, User } from "lucide-react";
import { ApiError } from "@/shared/api/errors";

export interface RegisterFormProps {
  onSuccess: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { mutate: registerAccount, isPending } = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "+91",
      password: "",
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setServerError(null);
    let normalizedPhone = data.phone.trim();
    if (normalizedPhone.length === 10 && !normalizedPhone.startsWith("+91")) {
      normalizedPhone = `+91${normalizedPhone}`;
    }
    registerAccount(
      {
        name: data.name,
        email: data.email,
        phone: normalizedPhone,
        password: data.password,
      },
      {
        onSuccess: () => {
          onSuccess();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.fieldErrors) {
            err.fieldErrors.forEach(({ field, message }) => {
              if (
                field === "name" ||
                field === "email" ||
                field === "phone" ||
                field === "password"
              ) {
                setError(field, { message });
              }
            });
          } else if (err instanceof ApiError && err.status === 409) {
            setServerError("An account with this email or phone number already exists.");
          } else {
            setServerError(
              "Unable to complete registration. Please check your inputs and try again.",
            );
          }
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
        <label htmlFor="register-name" className="block text-sm font-medium text-slate-700">
          Full name
        </label>
        <div className="relative">
          <User
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            disabled={isPending}
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={errors.name ? "register-name-error" : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
            placeholder="Tanmoy Sharma"
            {...register("name")}
          />
        </div>
        {errors.name && (
          <p id="register-name-error" className="text-xs text-red-600">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="register-email" className="block text-sm font-medium text-slate-700">
          Email address
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            disabled={isPending}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "register-email-error" : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
            placeholder="tanmoy@example.com"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p id="register-email-error" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="register-phone" className="block text-sm font-medium text-slate-700">
          Mobile number (India)
        </label>
        <div className="relative">
          <Phone
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            disabled={isPending}
            aria-invalid={errors.phone ? "true" : "false"}
            aria-describedby={errors.phone ? "register-phone-error" : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
            placeholder="+919876543210"
            {...register("phone")}
          />
        </div>
        {errors.phone && (
          <p id="register-phone-error" className="text-xs text-red-600">
            {errors.phone.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="register-password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            disabled={isPending}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "register-password-error" : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
            placeholder="At least 8 characters"
            {...register("password")}
          />
        </div>
        {errors.password && (
          <p id="register-password-error" className="text-xs text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
};

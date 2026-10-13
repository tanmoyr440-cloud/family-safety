import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  mfa_code: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{6}$/.test(val), {
      message: "MFA code must be exactly 6 digits",
    }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Phone number is required")
    .refine((val) => /^\+91[6-9]\d{9}$/.test(val) || /^[6-9]\d{9}$/.test(val), {
      message: "Please enter a valid 10-digit Indian mobile number (+91XXXXXXXXXX)",
    }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must contain digits only"),
});

export type MfaVerifyFormData = z.infer<typeof mfaVerifySchema>;

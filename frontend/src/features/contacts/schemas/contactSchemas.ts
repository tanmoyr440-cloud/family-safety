import { z } from "zod";

/**
 * Normalizes input phone to standard E.164 format.
 * Defaults 10-digit Indian numbers to +91.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  // If already starts with + and has digits
  if (trimmed.startsWith("+")) {
    return `+${digitsOnly}`;
  }

  // 10 digits starting with Indian telecom codes (6, 7, 8, 9)
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  // 12 digits starting with 91
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return `+${digitsOnly}`;
  }

  return trimmed;
}

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform(normalizePhone)
  .refine((val) => /^\+[1-9]\d{9,14}$/.test(val), {
    message: "Enter a valid 10-digit mobile number or international phone (e.g. +91 98765 43210)",
  });

export const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  relation: z.string().min(1, "Please select or enter a relation"),
  phone: phoneSchema,
  email: z.string().email("Enter a valid email address"),
  priority: z.number().int().min(1, "Priority must be at least 1"),
  locale: z.string(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

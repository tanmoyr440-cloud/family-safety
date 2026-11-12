import { z } from "zod";

export const insurancePolicySchema = z.object({
  policy_name: z.string().trim().min(2, "Policy name must be at least 2 characters").max(255),
  policy_type: z.enum(["HEALTH", "TERM_LIFE", "MOTOR", "CRITICAL_ILLNESS", "OTHER"]),
  policy_number: z.string().trim().min(2, "Policy number is required").max(128),
  insurer_name: z.string().trim().min(2, "Insurer name is required").max(255),
  sum_insured_inr: z.coerce.number().min(0, "Sum insured cannot be negative"),
  premium_amount_inr: z.coerce.number().min(0, "Premium cannot be negative").optional().nullable(),
  premium_due_date: z.string().optional().nullable(),
  cashless_tpa_name: z.string().trim().max(255).optional().nullable(),
  tpa_id_number: z.string().trim().max(128).optional().nullable(),
  emergency_helpline: z.string().trim().max(128).optional().nullable(),
  claim_email: z.string().trim().email("Invalid email address").or(z.literal("")).optional().nullable(),
  nominee_name: z.string().trim().max(255).optional().nullable(),
  nominee_relation: z.string().trim().max(64).optional().nullable(),
  hospital_cashless_notes: z.string().trim().max(2000).optional().nullable(),
});

export type InsurancePolicyFormValues = z.infer<typeof insurancePolicySchema>;

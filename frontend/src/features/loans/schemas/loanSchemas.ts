import { z } from "zod";

export const loanFormSchema = z.object({
  lender: z.string().trim().min(1, "Lender name is required"),
  account_number: z.string().trim().min(3, "Account number must be at least 3 characters"),
  emi_rupees: z.number().positive("EMI amount must be greater than zero"),
  due_day: z
    .number()
    .int("Due day must be a whole number")
    .min(1, "Due day must be between 1 and 31")
    .max(31, "Due day must be between 1 and 31"),
  grace_days: z
    .number()
    .int("Grace days must be a whole number")
    .min(0, "Grace days cannot be negative"),
  upi_id: z.string().trim().optional(),
  portal_url: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^https?:\/\/.+/i.test(val),
      "Must be a valid web URL starting with https:// or http://",
    ),
  notes: z.string().trim().optional(),
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;

export const editLoanFormSchema = loanFormSchema.omit({ account_number: true });
export type EditLoanFormValues = z.infer<typeof editLoanFormSchema>;

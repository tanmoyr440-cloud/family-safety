import { z } from "zod";

export const thresholdsSchema = z
  .object({
    threshold_days: z
      .number()
      .int("Threshold days must be a whole number")
      .min(30, "Inactivity threshold must be at least 30 days")
      .max(365, "Inactivity threshold cannot exceed 365 days"),
    warning_day_1: z
      .number()
      .int("First warning must be a whole number")
      .min(1, "Warning day must be at least 1"),
    warning_day_2: z
      .number()
      .int("Second warning must be a whole number")
      .min(1, "Warning day must be at least 1"),
    parent_repeat_every_days: z
      .number()
      .int("Repeat interval must be a whole number")
      .min(1, "Repeat interval must be at least 1 day")
      .max(30, "Repeat interval cannot exceed 30 days"),
  })
  .superRefine((data, ctx) => {
    if (data.warning_day_1 >= data.warning_day_2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warning_day_1"],
        message: "First warning day must be strictly less than second warning day",
      });
    }
    if (data.warning_day_2 >= data.threshold_days) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warning_day_2"],
        message: "Warning days must be strictly less than final alert threshold",
      });
    }
    if (data.warning_day_1 >= data.threshold_days) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warning_day_1"],
        message: "Warning days must be strictly less than final alert threshold",
      });
    }
  });

export type ThresholdsFormData = z.infer<typeof thresholdsSchema>;

export const MAX_PAUSE_DAYS_CAP = 90;

export const pauseSchema = z.object({
  until: z
    .string()
    .min(1, "Please choose a resume date")
    .refine((val) => {
      const selected = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selected > today;
    }, "Pause date must be in the future")
    .refine((val) => {
      const selected = new Date(val);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + MAX_PAUSE_DAYS_CAP);
      return selected <= maxDate;
    }, `Monitoring cannot be paused for more than ${MAX_PAUSE_DAYS_CAP} days`),
});

export type PauseFormData = z.infer<typeof pauseSchema>;

export const deleteAccountSchema = z.object({
  confirm_text: z
    .string()
    .refine((val) => val === "DELETE MY ACCOUNT", "Please type DELETE MY ACCOUNT to confirm"),
});

export type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;

export const loanGraceSchema = z.object({
  grace_days: z
    .number()
    .int("Grace days must be a whole number")
    .min(0, "Grace days cannot be negative")
    .max(15, "Grace days cannot exceed 15 days"),
});

export type LoanGraceFormData = z.infer<typeof loanGraceSchema>;

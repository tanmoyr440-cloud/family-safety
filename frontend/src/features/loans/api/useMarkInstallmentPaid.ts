import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { loanKeys } from "./keys";
import { monitorKeys } from "@/features/dashboard/api/keys";
import type { Installment } from "./useLoanInstallments";
import type { components } from "@/shared/api/schema";

export type MarkInstallmentPaidRequest = components["schemas"]["MarkInstallmentPaidRequest"];

export interface MarkInstallmentPaidArgs {
  loanId: string;
  yearMonth: string;
  reference?: string | null;
  note?: string | null;
}

export function useMarkInstallmentPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ loanId, yearMonth, reference, note }: MarkInstallmentPaidArgs) => {
      const result = await api.POST("/api/v1/loans/{id}/installments/{yyyy_mm}/mark-paid", {
        params: {
          path: {
            id: loanId,
            yyyy_mm: yearMonth,
          },
        },
        body: {
          reference: reference || null,
          note: note || null,
        },
      });
      return unwrap<Installment>(result);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loanKeys.all });
      queryClient.invalidateQueries({ queryKey: loanKeys.installments(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: monitorKeys.all });
    },
  });
}

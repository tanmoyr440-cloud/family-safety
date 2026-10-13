import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { loanKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type Installment = components["schemas"]["InstallmentResponse"];

export function useLoanInstallments(loanId: string | undefined) {
  return useQuery({
    queryKey: loanId ? loanKeys.installments(loanId) : ["loans", "none", "installments"],
    queryFn: async () => {
      if (!loanId) return [];
      const result = await api.GET("/api/v1/loans/{id}/installments", {
        params: {
          path: { id: loanId },
        },
      });
      return unwrap<Installment[]>(result);
    },
    enabled: Boolean(loanId),
    staleTime: 30_000,
  });
}

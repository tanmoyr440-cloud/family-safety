import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type LoanResponse = components["schemas"]["LoanResponse"];

export function useUpdateLoanGrace(loanId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (graceDays: number) => {
      if (!loanId) throw new Error("No active loan found to update");
      const result = await api.PATCH("/api/v1/loans/{id}", {
        params: {
          path: { id: loanId },
        },
        body: {
          grace_days: graceDays,
        },
      });
      return unwrap<LoanResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

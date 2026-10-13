import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { loanKeys } from "./keys";
import type { Loan } from "./useLoans";
import type { components } from "@/shared/api/schema";

export type CreateLoanRequest = components["schemas"]["CreateLoanRequest"];

export function useCreateLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLoanRequest) => {
      const result = await api.POST("/api/v1/loans", {
        body: payload,
      });
      return unwrap<Loan>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.all });
    },
  });
}

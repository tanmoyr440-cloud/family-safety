import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { loanKeys } from "./keys";
import type { Loan } from "./useLoans";
import type { components } from "@/shared/api/schema";

export type UpdateLoanRequest = components["schemas"]["UpdateLoanRequest"];

export interface UpdateLoanArgs {
  id: string;
  data: UpdateLoanRequest;
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateLoanArgs) => {
      const result = await api.PATCH("/api/v1/loans/{id}", {
        params: {
          path: { id },
        },
        body: data,
      });
      return unwrap<Loan>(result);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loanKeys.all });
      queryClient.invalidateQueries({ queryKey: loanKeys.detail(variables.id) });
    },
  });
}

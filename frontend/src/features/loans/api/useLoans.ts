import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { loanKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type Loan = components["schemas"]["LoanResponse"];

export function useLoans() {
  return useQuery({
    queryKey: loanKeys.list(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/loans");
      return unwrap<Loan[]>(result);
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

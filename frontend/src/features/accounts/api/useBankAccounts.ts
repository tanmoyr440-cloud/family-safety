import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { accountKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type BankAccount = components["schemas"]["BankAccountResponse"];
export type AddBankAccountRequest = components["schemas"]["AddBankAccountRequest"];

export function useBankAccounts() {
  return useQuery({
    queryKey: accountKeys.bankAccounts(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/bank-accounts");
      return unwrap<BankAccount[]>(result);
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useAddBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddBankAccountRequest) => {
      const result = await api.POST("/api/v1/bank-accounts", {
        body: payload,
      });
      return unwrap<BankAccount>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.bankAccounts() });
      queryClient.invalidateQueries({ queryKey: ["packet", "preview"] });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE("/api/v1/bank-accounts/{id}", {
        params: { path: { id } },
      });
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.bankAccounts() });
      queryClient.invalidateQueries({ queryKey: ["packet", "preview"] });
    },
  });
}

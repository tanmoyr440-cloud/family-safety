import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { accountKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type MutualFundScheme = components["schemas"]["MutualFundSchemeResponse"];
export type MutualFundNav = components["schemas"]["MutualFundNavResponse"];
export type MutualFundHolding = components["schemas"]["MutualFundHoldingResponse"];
export type AddMutualFundHoldingRequest = components["schemas"]["AddMutualFundHoldingRequest"];

export function useMutualFundHoldings() {
  return useQuery({
    queryKey: accountKeys.mutualFunds(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/mutual-funds/holdings");
      return unwrap<MutualFundHolding[]>(result);
    },
    staleTime: 60_000,
  });
}

export function useSearchMutualFunds(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: accountKeys.mfSearch(trimmed),
    queryFn: async () => {
      const result = await api.GET("/api/v1/mutual-funds/search", {
        params: { query: { q: trimmed } },
      });
      return unwrap<MutualFundScheme[]>(result);
    },
    enabled: trimmed.length >= 2,
    staleTime: 300_000,
  });
}

export function useMutualFundNav(schemeCode: number | null) {
  return useQuery({
    queryKey: accountKeys.mfNav(schemeCode ?? 0),
    queryFn: async () => {
      if (!schemeCode) return null;
      const result = await api.GET("/api/v1/mutual-funds/{scheme_code}/nav", {
        params: { path: { scheme_code: schemeCode } },
      });
      return unwrap<MutualFundNav>(result);
    },
    enabled: Boolean(schemeCode),
    staleTime: 600_000,
  });
}

export function useAddMutualFundHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddMutualFundHoldingRequest) => {
      const result = await api.POST("/api/v1/mutual-funds/holdings", {
        body: payload,
      });
      return unwrap<MutualFundHolding>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.mutualFunds() });
    },
  });
}

export function useDeleteMutualFundHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE("/api/v1/mutual-funds/holdings/{id}", {
        params: { path: { id } },
      });
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.mutualFunds() });
    },
  });
}

export function useClearAllMutualFundHoldings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await api.DELETE("/api/v1/mutual-funds/holdings");
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.mutualFunds() });
    },
  });
}


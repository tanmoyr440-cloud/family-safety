import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { insuranceKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type InsurancePolicy = components["schemas"]["InsurancePolicyResponse"];
export type AddInsurancePolicyRequest = components["schemas"]["AddInsurancePolicyRequest"];
export type UpdateInsurancePolicyRequest = components["schemas"]["UpdateInsurancePolicyRequest"];
export type ClaimPlaybookResponse = components["schemas"]["ClaimPlaybookResponse"];

export function useInsurancePolicies() {
  return useQuery({
    queryKey: insuranceKeys.list(),
    queryFn: async () => {
      const result = await (api as any).GET("/api/v1/insurance");
      return unwrap<InsurancePolicy[]>(result);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useInsurancePolicy(id: string | null | undefined) {
  return useQuery({
    queryKey: insuranceKeys.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      const result = await (api as any).GET("/api/v1/insurance/{id}", {
        params: { path: { id } },
      });
      return unwrap<InsurancePolicy>(result);
    },
    enabled: Boolean(id),
  });
}

export function useInsuranceClaimPlaybook(policyType: string) {
  return useQuery({
    queryKey: insuranceKeys.playbook(policyType),
    queryFn: async () => {
      const result = await (api as any).GET("/api/v1/insurance/playbook/{policy_type}", {
        params: { path: { policy_type: policyType } },
      });
      return unwrap<ClaimPlaybookResponse>(result);
    },
    staleTime: 60 * 60 * 1000, // 1 hour cached
    enabled: Boolean(policyType),
  });
}

export function useAddInsurancePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddInsurancePolicyRequest) => {
      const result = await (api as any).POST("/api/v1/insurance", {
        body: payload,
      });
      return unwrap<InsurancePolicy>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
      queryClient.invalidateQueries({ queryKey: ["packet", "preview"] });
    },
  });
}

export function useUpdateInsurancePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateInsurancePolicyRequest;
    }) => {
      const result = await (api as any).PATCH("/api/v1/insurance/{id}", {
        params: { path: { id } },
        body: data,
      });
      return unwrap<InsurancePolicy>(result);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
      queryClient.invalidateQueries({ queryKey: insuranceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ["packet", "preview"] });
    },
  });
}

export function useDeleteInsurancePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await (api as any).DELETE("/api/v1/insurance/{id}", {
        params: { path: { id } },
      });
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
      queryClient.invalidateQueries({ queryKey: ["packet", "preview"] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { accountKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type UpdateGrowwAccountRequest = components["schemas"]["UpdateGrowwAccountRequest"];
export type ActionResponse = components["schemas"]["ActionResponse"];

export function useUpdateGrowwAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateGrowwAccountRequest) => {
      const result = await api.PUT("/api/v1/accounts/groww", {
        body: data,
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.groww() });
    },
  });
}

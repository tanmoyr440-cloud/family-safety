import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { authKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type RegisterRequest = components["schemas"]["RegisterRequest"];
export type OwnerResponse = components["schemas"]["OwnerResponse"];

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterRequest) => {
      const result = await api.POST("/api/v1/auth/register", {
        body: payload,
      });
      return unwrap<OwnerResponse>(result);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

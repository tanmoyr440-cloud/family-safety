import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, clearStoredAuthTokens } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type ActionResponse = components["schemas"]["ActionResponse"];

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await api.POST("/api/v1/auth/logout");
      return unwrap<ActionResponse>(result);
    },
    onSettled: () => {
      clearStoredAuthTokens();
      queryClient.clear();
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { authKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type LoginRequest = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const result = await api.POST("/api/v1/auth/login", {
        body: credentials,
      });
      return unwrap<LoginResponse>(result);
    },
    onSuccess: (data) => {
      if (!data.mfa_required) {
        queryClient.setQueryData(authKeys.me(), data.owner);
        queryClient.invalidateQueries({ queryKey: authKeys.me() });
      }
    },
  });
}

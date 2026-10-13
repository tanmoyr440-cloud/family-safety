import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { authKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type MfaVerifyRequest = components["schemas"]["MfaVerifyRequest"];
export type ActionResponse = components["schemas"]["ActionResponse"];

export function useMfaVerify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MfaVerifyRequest) => {
      const result = await api.POST("/api/v1/auth/mfa/verify", {
        body: payload,
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

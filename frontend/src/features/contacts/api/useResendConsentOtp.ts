import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { contactKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type ActionResponse = components["schemas"]["ActionResponse"];

export function useResendConsentOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const result = await api.POST("/api/v1/contacts/{id}/verify/send", {
        params: { path: { id: contactId } },
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

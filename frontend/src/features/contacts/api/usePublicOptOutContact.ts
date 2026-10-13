import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type PublicOptOutRequest = components["schemas"]["PublicOptOutRequest"];
export type ActionResponse = components["schemas"]["ActionResponse"];

export function usePublicOptOutContact() {
  return useMutation({
    mutationFn: async (data: PublicOptOutRequest) => {
      const result = await api.POST("/api/v1/public/contacts/opt-out", {
        body: data,
      });
      return unwrap<ActionResponse>(result);
    },
  });
}

import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type PublicVerifyContactRequest = components["schemas"]["PublicVerifyContactRequest"];
export type ActionResponse = components["schemas"]["ActionResponse"];

export function usePublicVerifyContact() {
  return useMutation({
    mutationFn: async (data: PublicVerifyContactRequest) => {
      const result = await api.POST("/api/v1/public/contacts/verify", {
        body: data,
      });
      return unwrap<ActionResponse>(result);
    },
  });
}

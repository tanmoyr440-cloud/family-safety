import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { contactKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type CreateContactRequest = components["schemas"]["CreateContactRequest"];
export type ContactResponse = components["schemas"]["ContactResponse"];

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContactRequest) => {
      const result = await api.POST("/api/v1/contacts", {
        body: data,
      });
      return unwrap<ContactResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      queryClient.invalidateQueries({ queryKey: ["monitor"] });
    },
  });
}

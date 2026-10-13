import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { contactKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type UpdateContactRequest = components["schemas"]["UpdateContactRequest"];
export type ContactResponse = components["schemas"]["ContactResponse"];

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateContactRequest }) => {
      const result = await api.PATCH("/api/v1/contacts/{id}", {
        params: { path: { id } },
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

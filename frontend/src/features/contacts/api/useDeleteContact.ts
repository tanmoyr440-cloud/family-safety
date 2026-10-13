import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { contactKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type ActionResponse = components["schemas"]["ActionResponse"];

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE("/api/v1/contacts/{id}", {
        params: { path: { id } },
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      queryClient.invalidateQueries({ queryKey: ["monitor"] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { documentKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type ActionResponse = components["schemas"]["ActionResponse"];

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE("/api/v1/documents/{id}", {
        params: { path: { id } },
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

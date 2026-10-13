import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { documentKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type Document = components["schemas"]["DocumentResponse"];

export function useDocuments() {
  return useQuery({
    queryKey: documentKeys.list(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/documents");
      return unwrap<Document[]>(result);
    },
    staleTime: 60_000,
  });
}

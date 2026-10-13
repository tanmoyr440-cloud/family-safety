import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { authKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type Owner = components["schemas"]["OwnerResponse"];

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/me");
      return unwrap<Owner>(result);
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

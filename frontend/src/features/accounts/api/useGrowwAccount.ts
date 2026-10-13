import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { accountKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type GrowwAccount = components["schemas"]["GrowwAccountResponse"];

export function useGrowwAccount() {
  return useQuery({
    queryKey: accountKeys.groww(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/accounts/groww");
      return unwrap<GrowwAccount>(result);
    },
    staleTime: 60_000,
  });
}

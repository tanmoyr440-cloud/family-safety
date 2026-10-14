import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { accountKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type NomineeGuidance = components["schemas"]["NomineeGuidanceResponse"];
export type NomineeItem = components["schemas"]["NomineeItem"];
export type UpdateNomineeGuidanceRequest = components["schemas"]["UpdateNomineeGuidanceRequest"];

export function useNomineeGuidance() {
  return useQuery({
    queryKey: accountKeys.nomineeGuidance(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/accounts/nominee-guidance");
      return unwrap<NomineeGuidance>(result);
    },
    staleTime: 60_000,
  });
}

export function useUpdateNomineeGuidance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateNomineeGuidanceRequest) => {
      const result = await api.PUT("/api/v1/accounts/nominee-guidance", {
        body: payload,
      });
      return unwrap<NomineeGuidance>(result);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(accountKeys.nomineeGuidance(), updated);
      queryClient.invalidateQueries({ queryKey: accountKeys.nomineeGuidance() });
      queryClient.invalidateQueries({ queryKey: ["packet", "preview"] });
    },
  });
}

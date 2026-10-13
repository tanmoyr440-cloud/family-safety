import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { packetKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type ActionResponse = components["schemas"]["ActionResponse"];

export function useRevokePacketShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: string) => {
      const result = await api.DELETE("/api/v1/packet/shares/{id}", {
        params: { path: { id: shareId } },
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packetKeys.shares() });
    },
  });
}

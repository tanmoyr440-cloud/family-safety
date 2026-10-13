import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { packetKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type PacketShare = components["schemas"]["PacketShareResponse"];

export function useCreatePacketShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const result = await api.POST("/api/v1/packet/shares", {
        body: { contact_id: contactId },
      });
      return unwrap<PacketShare>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packetKeys.shares() });
    },
  });
}

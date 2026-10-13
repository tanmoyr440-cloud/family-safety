import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { packetKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type PacketPreview = components["schemas"]["PacketPreviewResponse"];

export function usePacketPreview(contactId?: string | null) {
  return useQuery({
    queryKey: packetKeys.preview(contactId),
    queryFn: async () => {
      const result = await api.GET("/api/v1/packet/preview", {
        params: {
          query: {
            contact_id: contactId || undefined,
          },
        },
      });
      return unwrap<PacketPreview>(result);
    },
    staleTime: 60_000,
  });
}

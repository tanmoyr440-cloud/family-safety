import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { packetKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type PacketShare = components["schemas"]["PacketShareResponse"];

export function usePacketShares() {
  return useQuery({
    queryKey: packetKeys.shares(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/packet/shares");
      return unwrap<PacketShare[]>(result);
    },
    staleTime: 30_000,
  });
}

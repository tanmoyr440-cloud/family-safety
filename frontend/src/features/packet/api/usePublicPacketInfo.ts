import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { packetKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type PublicPacketInfo = components["schemas"]["PublicPacketInfoResponse"];

export function usePublicPacketInfo(token: string) {
  return useQuery({
    queryKey: packetKeys.publicInfo(token),
    queryFn: async () => {
      const result = await api.GET("/api/v1/public/packet/{token}", {
        params: { path: { token } },
      });
      return unwrap<PublicPacketInfo>(result);
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });
}

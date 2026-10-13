import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { packetKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type PublicPacketSessionData = components["schemas"]["PacketPreviewResponse"];

export function usePublicPacketSession(sessionToken: string | null) {
  return useQuery({
    queryKey: packetKeys.session(sessionToken),
    queryFn: async () => {
      if (!sessionToken) {
        throw new Error("No active session");
      }
      const result = await api.GET("/api/v1/public/packet/session", {
        params: {
          query: {
            session_token: sessionToken,
          },
          header: {
            authorization: `Bearer ${sessionToken}`,
          },
        },
      });
      return unwrap<PublicPacketSessionData>(result);
    },
    enabled: Boolean(sessionToken),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

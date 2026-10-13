import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type ActionResponse = components["schemas"]["ActionResponse"];

export function useSendPublicPacketOtp(token: string) {
  return useMutation({
    mutationFn: async () => {
      const result = await api.POST("/api/v1/public/packet/{token}/otp/send", {
        params: { path: { token } },
      });
      return unwrap<ActionResponse>(result);
    },
  });
}

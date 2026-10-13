import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type PublicPacketOtpVerifyResponse = components["schemas"]["PublicPacketOtpVerifyResponse"];

export function useVerifyPublicPacketOtp(token: string) {
  return useMutation({
    mutationFn: async (otp: string) => {
      const result = await api.POST("/api/v1/public/packet/{token}/otp/verify", {
        params: { path: { token } },
        body: { otp },
      });
      return unwrap<PublicPacketOtpVerifyResponse>(result);
    },
  });
}

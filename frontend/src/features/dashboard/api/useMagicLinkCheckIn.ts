import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type CheckInResponse = components["schemas"]["CheckInResponse"];

export function useMagicLinkCheckIn() {
  return useMutation({
    mutationFn: async (token: string) => {
      const result = await api.POST("/api/v1/activity/check-in/link/{token}", {
        params: {
          path: { token },
        },
      });
      return unwrap<CheckInResponse>(result);
    },
  });
}

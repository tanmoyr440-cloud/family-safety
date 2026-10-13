import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type MfaEnrollResponse = components["schemas"]["MfaEnrollResponse"];

export function useMfaEnroll() {
  return useMutation({
    mutationFn: async () => {
      const result = await api.POST("/api/v1/auth/mfa/enroll");
      return unwrap<MfaEnrollResponse>(result);
    },
  });
}

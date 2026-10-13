import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type UpdateMonitorConfigPayload = components["schemas"]["UpdateMonitorConfigRequest"];
export type ActionResponse = components["schemas"]["ActionResponse"];

export function useUpdateMonitorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateMonitorConfigPayload) => {
      const result = await api.PUT("/api/v1/monitor/config", {
        body: payload,
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor"] });
    },
  });
}

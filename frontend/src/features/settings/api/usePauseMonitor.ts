import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type PauseMonitorPayload = components["schemas"]["PauseMonitorRequest"];
export type ActionResponse = components["schemas"]["ActionResponse"];

export function usePauseMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PauseMonitorPayload) => {
      const result = await api.POST("/api/v1/monitor/pause", {
        body: payload,
      });
      return unwrap<ActionResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor"] });
      queryClient.invalidateQueries({ queryKey: ["owner"] });
    },
  });
}

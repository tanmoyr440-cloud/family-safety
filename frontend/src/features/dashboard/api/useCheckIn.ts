import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { monitorKeys } from "./keys";
import type { MonitorStatus } from "./useMonitorStatus";
import type { components } from "@/shared/api/schema";

export type CheckInResponse = components["schemas"]["CheckInResponse"];

export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await api.POST("/api/v1/activity/check-in");
      return unwrap<CheckInResponse>(result);
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: monitorKeys.status() });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData<MonitorStatus>(monitorKeys.status());

      // Optimistically reset days_idle to 0 and status to "OK"
      if (previousStatus) {
        queryClient.setQueryData<MonitorStatus>(monitorKeys.status(), {
          ...previousStatus,
          status: "OK",
          days_idle: 0,
          last_activity_at: new Date().toISOString(),
        });
      }

      return { previousStatus };
    },
    onError: (_err, _variables, context) => {
      // Rollback on failure
      if (context?.previousStatus) {
        queryClient.setQueryData(monitorKeys.status(), context.previousStatus);
      }
    },
    onSettled: () => {
      // Reconcile with actual server response
      queryClient.invalidateQueries({ queryKey: monitorKeys.all });
    },
  });
}

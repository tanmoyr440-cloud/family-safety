import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { notificationKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type SendEmergencyAlertRequest = components["schemas"]["SendEmergencyAlertRequest"];
export type SendEmergencyAlertResponse = components["schemas"]["SendEmergencyAlertResponse"];

export function useSendEmergencyAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendEmergencyAlertRequest = {}) => {
      const result = await api.POST("/api/v1/notifications/send-emergency-alert", {
        body: data,
      });
      return unwrap<SendEmergencyAlertResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

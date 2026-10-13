import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { notificationKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type NotificationLogItem = components["schemas"]["NotificationLogItemResponse"];

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/notifications");
      return unwrap<NotificationLogItem[]>(result);
    },
    staleTime: 30_000,
  });
}

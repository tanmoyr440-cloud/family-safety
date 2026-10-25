import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { monitorKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type MonitorStatus = components["schemas"]["MonitorStatusResponse"];

export function useMonitorStatus() {
  return useQuery({
    queryKey: monitorKeys.status(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/monitor");
      return unwrap<MonitorStatus>(result);
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type MonitorStatus = components["schemas"]["MonitorStatusResponse"];
export type OwnerProfile = components["schemas"]["OwnerResponse"];
export type Loan = components["schemas"]["LoanResponse"];

export interface SettingsData {
  monitor: MonitorStatus;
  owner: OwnerProfile;
  loans: Loan[];
}

export function useSettingsData() {
  return useQuery({
    queryKey: ["settings", "bundle"],
    queryFn: async (): Promise<SettingsData> => {
      const [monitorRes, ownerRes, loansRes] = await Promise.all([
        api.GET("/api/v1/monitor"),
        api.GET("/api/v1/me"),
        api.GET("/api/v1/loans"),
      ]);

      const monitor = unwrap<MonitorStatus>(monitorRes);
      const owner = unwrap<OwnerProfile>(ownerRes);
      const loans = unwrap<Loan[]>(loansRes);

      return { monitor, owner, loans };
    },
    staleTime: 30_000,
  });
}

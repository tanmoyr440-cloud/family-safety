import { useMutation } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";

export type OwnerExportData = components["schemas"]["OwnerExportResponse"];

export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const result = await api.GET("/api/v1/me/export");
      const data = unwrap<OwnerExportData>(result);

      if (typeof window !== "undefined") {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `family-safety-net-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      return data;
    },
  });
}

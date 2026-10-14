import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { accountKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type CasImportResponse = components["schemas"]["CasImportResponse"];

export interface ImportCasParams {
  file: File;
  password?: string;
}

export function useImportCas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, password }: ImportCasParams) => {
      const formData = new FormData();
      formData.append("file", file);
      if (password && password.trim()) {
        formData.append("password", password.trim());
      }

      const result = await api.POST("/api/v1/mutual-funds/import-cas", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: formData as any,
      });

      return unwrap<CasImportResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.mutualFunds() });
      queryClient.invalidateQueries({ queryKey: accountKeys.portfolioSummary() });
    },
  });
}

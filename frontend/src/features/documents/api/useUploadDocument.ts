import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { documentKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type DocumentResponse = components["schemas"]["DocumentResponse"];

export interface UploadDocumentParams {
  file: File;
  title: string;
  category: string;
  onProgress?: (percent: number) => void;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, title, category, onProgress }: UploadDocumentParams) => {
      onProgress?.(25);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("category", category);

      onProgress?.(60);

      // openapi-fetch typed post with multipart body
      const result = await api.POST("/api/v1/documents", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: formData as any,
      });

      onProgress?.(100);
      return unwrap<DocumentResponse>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

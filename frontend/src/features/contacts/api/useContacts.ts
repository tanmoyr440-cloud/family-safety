import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { contactKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type Contact = components["schemas"]["ContactResponse"];

export function useContacts() {
  return useQuery({
    queryKey: contactKeys.list(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/contacts");
      return unwrap<Contact[]>(result);
    },
    staleTime: 60_000,
  });
}

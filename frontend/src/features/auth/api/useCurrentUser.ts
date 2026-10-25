import { useQuery } from "@tanstack/react-query";
import {
  api,
  getStoredUser,
  setStoredUser,
  getStoredAccessToken,
  getStoredRefreshToken,
  readCsrfToken,
} from "@/shared/api/client";
import { unwrap } from "@/shared/api/errors";
import { authKeys } from "./keys";
import type { components } from "@/shared/api/schema";

export type Owner = components["schemas"]["OwnerResponse"];

export function useCurrentUser() {
  const cachedUser = getStoredUser();
  const hasToken = Boolean(getStoredAccessToken() || getStoredRefreshToken() || readCsrfToken());

  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const result = await api.GET("/api/v1/me");
      const user = unwrap<Owner>(result);
      setStoredUser(user);
      return user;
    },
    enabled: hasToken,
    initialData: hasToken && cachedUser ? cachedUser : undefined,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

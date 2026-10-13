import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/shared/api/queryClient";

export interface AppProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children, queryClient }) => {
  const [client] = React.useState(() => queryClient ?? createQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

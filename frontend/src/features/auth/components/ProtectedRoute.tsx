import * as React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../api/useCurrentUser";
import { Skeleton } from "@/shared/ui/Skeleton";

export interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { data: user, isLoading, isError } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 items-center justify-center">
        <div
          className="w-full max-w-md space-y-4"
          role="status"
          aria-label="Authenticating session"
        >
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-40 w-full" />
          <span className="sr-only">Checking authentication status...</span>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?return_to=${returnTo}`} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

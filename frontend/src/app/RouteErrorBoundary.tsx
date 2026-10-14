import * as React from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/shared/ui/Button";

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  const errorMessage = React.useMemo(() => {
    if (isRouteErrorResponse(error)) {
      return `${error.status} ${error.statusText || error.data}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred while loading this page.";
  }, [error]);

  const isChunkLoadError = React.useMemo(() => {
    const text = String(errorMessage).toLowerCase();
    return (
      text.includes("dynamically imported module") ||
      text.includes("failed to fetch") ||
      text.includes("loading chunk") ||
      text.includes("chunkloaderror")
    );
  }, [errorMessage]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {isChunkLoadError ? "Application Updated" : "Page Load Issue"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {isChunkLoadError
            ? "A newer version of Family Safety Net is available. Reloading will fetch the latest assets seamlessly."
            : errorMessage}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={handleReload} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reload Page
          </Button>
          <Button onClick={handleGoHome} variant="outline" className="w-full">
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./layout/Layout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { MfaEnrollPage } from "@/features/auth/pages/MfaEnrollPage";
import { CheckInLandingPage } from "@/features/dashboard/pages/CheckInLandingPage";
import { VerifyContactPage } from "@/features/contacts/pages/VerifyContactPage";
import { NotFoundPage } from "./pages/Placeholders";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

/**
 * Resilient lazy loader that detects chunk mismatch errors after new production deployments
 * and automatically refreshes once to fetch the latest application bundle.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const hasBeenRefreshed = sessionStorage.getItem("lazy_retry_refreshed") === "true";

    try {
      const component = await factory();
      sessionStorage.removeItem("lazy_retry_refreshed");
      return component;
    } catch (error: unknown) {
      const errStr = String(error);
      const isChunkLoadError =
        errStr.includes("dynamically imported module") ||
        errStr.includes("Failed to fetch") ||
        errStr.includes("loading chunk") ||
        errStr.includes("ChunkLoadError");

      if (isChunkLoadError && !hasBeenRefreshed) {
        sessionStorage.setItem("lazy_retry_refreshed", "true");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";

const AccountsPage = lazyWithRetry(() =>
  import("@/features/accounts/pages/AccountsPage").then((m) => ({ default: m.AccountsPage })),
);
const LoansPage = lazyWithRetry(() =>
  import("@/features/loans/pages/LoansPage").then((m) => ({ default: m.LoansPage })),
);
const ContactsPage = lazyWithRetry(() =>
  import("@/features/contacts/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })),
);
const DocumentsPage = lazyWithRetry(() =>
  import("@/features/documents/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
const NotificationsPage = lazyWithRetry(() =>
  import("@/features/notifications/pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const SettingsPage = lazyWithRetry(() =>
  import("@/features/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const PublicPacketPage = lazyWithRetry(() =>
  import("@/features/packet/pages/PublicPacketPage").then((m) => ({ default: m.PublicPacketPage })),
);

const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]" aria-label="Loading page">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const withSuspense = (component: React.ReactNode) => (
  <React.Suspense fallback={<LazyFallback />}>{component}</React.Suspense>
);

export const router = createBrowserRouter([
  // Public Auth Routes
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
    errorElement: <RouteErrorBoundary />,
  },

  // Public Check-in Magic Link Route (isolated, no owner chrome)
  {
    path: "/checkin/:token",
    element: <CheckInLandingPage />,
    errorElement: <RouteErrorBoundary />,
  },

  // Public Parent Contact Verification Route (isolated, no owner chrome)
  {
    path: "/verify-contact/:token",
    element: <VerifyContactPage />,
    errorElement: <RouteErrorBoundary />,
  },

  // Public Parent Packet Route (isolated, code-split from owner bundle)
  {
    path: "/p/:token",
    element: withSuspense(<PublicPacketPage />),
    errorElement: <RouteErrorBoundary />,
  },

  // Protected Owner App Routes
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "accounts", element: withSuspense(<AccountsPage />) },
      { path: "loans", element: withSuspense(<LoansPage />) },
      { path: "contacts", element: withSuspense(<ContactsPage />) },
      { path: "documents", element: withSuspense(<DocumentsPage />) },
      { path: "notifications", element: withSuspense(<NotificationsPage />) },
      { path: "settings", element: withSuspense(<SettingsPage />) },
      { path: "mfa/enroll", element: <MfaEnrollPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },

  // Fallback Catch-all
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

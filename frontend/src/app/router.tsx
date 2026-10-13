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

// Route-level code-splitting: isolate owner app from parent-facing packet bundles
const DashboardPage = React.lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const AccountsPage = React.lazy(() =>
  import("@/features/accounts/pages/AccountsPage").then((m) => ({ default: m.AccountsPage })),
);
const LoansPage = React.lazy(() =>
  import("@/features/loans/pages/LoansPage").then((m) => ({ default: m.LoansPage })),
);
const ContactsPage = React.lazy(() =>
  import("@/features/contacts/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })),
);
const DocumentsPage = React.lazy(() =>
  import("@/features/documents/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
const NotificationsPage = React.lazy(() =>
  import("@/features/notifications/pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const SettingsPage = React.lazy(() =>
  import("@/features/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const PublicPacketPage = React.lazy(() =>
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
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },

  // Public Check-in Magic Link Route (isolated, no owner chrome)
  {
    path: "/checkin/:token",
    element: <CheckInLandingPage />,
  },

  // Public Parent Contact Verification Route (isolated, no owner chrome)
  {
    path: "/verify-contact/:token",
    element: <VerifyContactPage />,
  },

  // Public Parent Packet Route (isolated, code-split from owner bundle)
  {
    path: "/p/:token",
    element: withSuspense(<PublicPacketPage />),
  },

  // Protected Owner App Routes
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
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

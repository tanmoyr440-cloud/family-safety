import * as React from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { StatusPill } from "@/shared/ui/StatusPill";

export const DashboardPlaceholder: React.FC = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Monitor your investment activity and upcoming EMI obligations.
        </p>
      </div>
      <StatusPill tone="success" label="All monitors healthy" />
    </div>
    <Card>
      <CardHeader>
        <CardTitle>Activity Status</CardTitle>
        <CardDescription>Inactivity evaluation and check-in timeline.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">
          Foundation scaffold ready. Feature screens will connect in Phase 2 &amp; 3.
        </p>
      </CardContent>
    </Card>
  </div>
);

export const LoansPlaceholder: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Loans &amp; Obligations</h1>
    <Card>
      <CardHeader>
        <CardTitle>Car Loan EMI</CardTitle>
        <CardDescription>Monthly installment tracking and payment confirmation.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">Loan installment tracker will connect in Phase 4.</p>
      </CardContent>
    </Card>
  </div>
);

export const ContactsPlaceholder: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Trusted Family Contacts</h1>
    <Card>
      <CardHeader>
        <CardTitle>Emergency Contacts</CardTitle>
        <CardDescription>
          Verified parents and guardians notified upon emergency triggers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">Contact verification flow will connect in Phase 5.</p>
      </CardContent>
    </Card>
  </div>
);

export const DocumentsPlaceholder: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Encrypted Documents</h1>
    <Card>
      <CardHeader>
        <CardTitle>Emergency Document Vault</CardTitle>
        <CardDescription>
          Insurance policies, nominee instructions, and investment notes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">
          Encrypted document storage will connect in Phase 6.
        </p>
      </CardContent>
    </Card>
  </div>
);

export const NotificationsPlaceholder: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Notification Log</h1>
    <Card>
      <CardHeader>
        <CardTitle>Delivery History</CardTitle>
        <CardDescription>
          Audit record of warning and emergency messages sent to family.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">Delivery pipeline log will connect in Phase 7.</p>
      </CardContent>
    </Card>
  </div>
);

export const SettingsPlaceholder: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold tracking-tight">Settings &amp; Thresholds</h1>
    <Card>
      <CardHeader>
        <CardTitle>Monitoring Thresholds</CardTitle>
        <CardDescription>
          Custom inactivity days, grace periods, and pause durations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">Settings management will connect in Phase 9.</p>
      </CardContent>
    </Card>
  </div>
);

export const PublicPacketPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Emergency Information Packet</CardTitle>
          <CardDescription>Secure OTP verification required for access.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Access token: <span className="font-mono text-xs">{token}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export const NotFoundPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <h1 className="text-4xl font-bold tracking-tight">404</h1>
    <p className="mt-2 text-sm text-slate-500">The page you are looking for does not exist.</p>
    <a href="/" className="mt-4 text-sm font-medium text-blue-600 hover:underline">
      Return to Dashboard
    </a>
  </div>
);

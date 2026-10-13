import * as React from "react";
import { BankAccountsCard } from "../components/BankAccountsCard";
import { HoldingsSnapshotCard } from "../components/HoldingsSnapshotCard";
import { NomineeNotesCard } from "../components/NomineeNotesCard";
import { Landmark } from "lucide-react";

export const AccountsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Landmark className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          Financial Accounts & Investments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your savings bank accounts, mutual fund portfolios with live SEBI/AMFI valuations, and nominee guidance.
        </p>
      </div>

      <div className="space-y-6">
        <BankAccountsCard />
        <HoldingsSnapshotCard />
        <NomineeNotesCard />
      </div>
    </div>
  );
};


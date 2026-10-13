import * as React from "react";
import { ShieldCheck } from "lucide-react";

export interface PublicPacketLayoutProps {
  children: React.ReactNode;
}

export const PublicPacketLayout: React.FC<PublicPacketLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 antialiased font-sans">
      {/* Top Reassurance Header */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 block">
                Family Safety Net
              </span>
              <span className="text-[11px] text-muted-foreground block -mt-0.5">
                Confidential Emergency Guidance
              </span>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              End-to-End Encrypted Access
            </span>
          </div>
        </div>
      </header>

      {/* Main Single Column Container */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      {/* Discreet Footer (hidden on print) */}
      <footer className="no-print border-t border-slate-200/80 bg-white/50 py-6 text-center text-xs text-muted-foreground">
        <p>Family Safety Net • Private Emergency System</p>
      </footer>
    </div>
  );
};

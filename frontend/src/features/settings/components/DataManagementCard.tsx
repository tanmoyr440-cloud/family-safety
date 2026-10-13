import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { useExportData } from "../api/useExportData";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { Download, HardDrive, Trash2 } from "lucide-react";

export const DataManagementCard: React.FC = () => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const { mutate: exportData, isPending: isExporting } = useExportData();

  return (
    <>
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Data Management &amp; Privacy
              </CardTitle>
              <CardDescription className="text-xs">
                Export your full data bundle or permanently erase your account.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Export Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <div>
              <span className="text-xs font-semibold text-slate-900 block">
                Export Data Bundle (DPDP / GDPR)
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Download a complete JSON export of your profile, monitors, loans, and contact
                records.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportData()}
              isLoading={isExporting}
              className="shrink-0"
            >
              <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Export My Data
            </Button>
          </div>

          {/* Delete Account Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 bg-red-50/30">
            <div>
              <span className="text-xs font-semibold text-red-950 block">Delete Account</span>
              <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                Permanently purge your account, inactivity monitoring, and all stored data.
              </p>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </>
  );
};

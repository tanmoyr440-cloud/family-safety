import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { AddBankAccountDialog } from "./AddBankAccountDialog";
import { useBankAccounts, useDeleteBankAccount, type BankAccount } from "../api/useBankAccounts";
import { Building2, Check, Copy, Info, Loader2, Plus, Trash2 } from "lucide-react";

export const BankAccountsCard: React.FC = () => {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [copiedIfscId, setCopiedIfscId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const { data: accounts, isLoading } = useBankAccounts();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteBankAccount();

  const handleCopyIfsc = async (account: BankAccount) => {
    try {
      await navigator.clipboard.writeText(account.ifsc_code);
      setCopiedIfscId(account.id);
      setTimeout(() => setCopiedIfscId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDelete = (account: BankAccount) => {
    if (window.confirm(`Are you sure you want to remove ${account.bank_name} (${account.account_number_masked})?`)) {
      setDeletingId(account.id);
      deleteAccount(account.id, {
        onSettled: () => setDeletingId(null),
      });
    }
  };

  const hasAccounts = Boolean(accounts && accounts.length > 0);

  return (
    <>
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Savings & Bank Accounts
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bank accounts recorded for emergency claims and nominee guidance
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Bank Account
          </Button>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              Recording your savings bank accounts ensures your family has the branch and IFSC details
              needed to coordinate formal nominee settlement procedures with the bank.
            </p>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Loading registered bank accounts...
            </div>
          ) : hasAccounts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {accounts!.map((account) => {
                const isCurrentlyDeleting = isDeleting && deletingId === account.id;
                const isCopied = copiedIfscId === account.id;

                return (
                  <div
                    key={account.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {account.bank_name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {account.account_type || "SAVINGS"}
                          </span>
                        </div>
                        {account.branch_name && (
                          <p className="text-[11px] text-slate-500">{account.branch_name}</p>
                        )}
                        {account.holder_name && (
                          <p className="text-[11px] text-slate-600 font-medium">
                            Holder: {account.holder_name}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        disabled={isCurrentlyDeleting}
                        aria-label={`Delete ${account.bank_name} account`}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        {isCurrentlyDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Account Number
                        </span>
                        <span className="font-mono font-medium text-slate-900 text-xs">
                          {account.account_number_masked}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          IFSC Code
                        </span>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="font-mono font-semibold text-slate-900 text-xs">
                            {account.ifsc_code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyIfsc(account)}
                            title="Copy IFSC code"
                            aria-label={`Copy IFSC for ${account.bank_name}`}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-900">
                  No bank accounts registered
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Add your primary savings bank accounts so family members know where your salary
                  and accounts are maintained.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Bank Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddBankAccountDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
    </>
  );
};

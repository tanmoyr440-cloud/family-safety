export const accountKeys = {
  all: ["accounts"] as const,
  groww: () => [...accountKeys.all, "groww"] as const,
  mutualFunds: () => [...accountKeys.all, "mutual-funds"] as const,
  mfSearch: (q: string) => [...accountKeys.all, "mf-search", q] as const,
  mfNav: (code: number) => [...accountKeys.all, "mf-nav", code] as const,
  bankAccounts: () => [...accountKeys.all, "bank-accounts"] as const,
};



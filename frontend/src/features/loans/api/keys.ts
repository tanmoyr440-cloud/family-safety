export const loanKeys = {
  all: ["loans"] as const,
  list: () => [...loanKeys.all, "list"] as const,
  detail: (id: string) => [...loanKeys.all, "detail", id] as const,
  installments: (id: string) => [...loanKeys.all, id, "installments"] as const,
};

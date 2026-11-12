export const insuranceKeys = {
  all: ["insurance"] as const,
  list: () => [...insuranceKeys.all, "list"] as const,
  detail: (id: string) => [...insuranceKeys.all, "detail", id] as const,
  playbook: (policyType: string) => [...insuranceKeys.all, "playbook", policyType] as const,
};

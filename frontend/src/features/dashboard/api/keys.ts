export const monitorKeys = {
  all: ["monitor"] as const,
  status: () => [...monitorKeys.all, "status"] as const,
  scheduler: () => [...monitorKeys.all, "scheduler"] as const,
};

export const settingsKeys = {
  all: ["settings"] as const,
  config: () => [...settingsKeys.all, "config"] as const,
  export: () => [...settingsKeys.all, "export"] as const,
};

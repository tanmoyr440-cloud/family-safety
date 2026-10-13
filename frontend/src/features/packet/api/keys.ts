export const packetKeys = {
  all: ["packet"] as const,
  preview: (contactId?: string | null) =>
    [...packetKeys.all, "preview", contactId || "default"] as const,
  shares: () => [...packetKeys.all, "shares"] as const,
  publicInfo: (token: string) => [...packetKeys.all, "publicInfo", token] as const,
  session: (sessionToken: string | null) =>
    [...packetKeys.all, "session", sessionToken || "none"] as const,
};

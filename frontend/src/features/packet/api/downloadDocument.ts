export async function downloadPublicPacketDocument(
  sessionToken: string,
  documentId: string,
  filename: string,
) {
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
      ? window.location.origin
      : "http://localhost:3000");

  const url = `${baseUrl}/api/v1/public/packet/session/documents/${documentId}?session_token=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!res.ok) {
    throw new Error("Unable to download document. Your session may have expired.");
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}

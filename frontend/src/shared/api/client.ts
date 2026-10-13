import createClient from "openapi-fetch";
import type { paths } from "./schema";

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:3000");

const baseUrl = rawBaseUrl.replace(/\/+$/, "");

export const api = createClient<paths>({
  baseUrl,
  credentials: "include",
  fetch: (...args) => globalThis.fetch(...args),
});

let refreshPromise: Promise<boolean> | null = null;

/**
 * Executes a single shared refresh call.
 * Concurrent 401 requests share this identical in-flight promise.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const csrf = readCsrfToken();
      const headers: Record<string, string> = {};
      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
      });

      if (!res.ok) {
        throw new Error(`Refresh failed with status ${res.status}`);
      }
      return true;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Middleware attaching X-CSRF-Token on state-mutating requests
api.use({
  onRequest({ request }) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const csrf = readCsrfToken();
      if (csrf) {
        request.headers.set("X-CSRF-Token", csrf);
      }
    }
    return request;
  },

  async onResponse({ request, response }) {
    // If unauthorized and not already an auth endpoint (prevent recursion)
    if (
      response.status === 401 &&
      !request.url.includes("/api/v1/auth/login") &&
      !request.url.includes("/api/v1/auth/refresh") &&
      !request.url.includes("/api/v1/auth/register") &&
      !request.url.includes("/api/v1/public/")
    ) {
      try {
        await refreshSession();

        // Retry original request with fresh credentials/cookies
        const retryRequest = request.clone();
        if (!["GET", "HEAD", "OPTIONS"].includes(retryRequest.method)) {
          const csrf = readCsrfToken();
          if (csrf) {
            retryRequest.headers.set("X-CSRF-Token", csrf);
          }
        }
        return await fetch(retryRequest);
      } catch {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
      }
    }
    return response;
  },
});

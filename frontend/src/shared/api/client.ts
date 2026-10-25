import createClient from "openapi-fetch";
import type { paths, components } from "./schema";

export type StoredOwner = components["schemas"]["OwnerResponse"];

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let memoryCsrfToken: string | null = null;
let memoryUser: StoredOwner | null = null;

const ACCESS_TOKEN_KEY = "fsn_auth_access";
const REFRESH_TOKEN_KEY = "fsn_auth_refresh";
const CSRF_TOKEN_KEY = "fsn_auth_csrf";
const CACHED_USER_KEY = "fsn_auth_user";

// Legacy keys for smooth session migration
const LEGACY_ACCESS_KEY = "fsn_s_access";
const LEGACY_REFRESH_KEY = "fsn_s_refresh";
const LEGACY_CSRF_KEY = "fsn_s_csrf";

function getStorageItem(key: string, legacyKey?: string): string | null {
  try {
    if (typeof window !== "undefined") {
      if (window.localStorage) {
        const val = localStorage.getItem(key);
        if (val) return val;
      }
      if (window.sessionStorage) {
        const sVal = sessionStorage.getItem(key);
        if (sVal) return sVal;
        if (legacyKey) {
          const lVal = sessionStorage.getItem(legacyKey);
          if (lVal) {
            try {
              if (window.localStorage) localStorage.setItem(key, lVal);
            } catch {
              // ignore
            }
            return lVal;
          }
        }
      }
    }
  } catch {
    // Storage might be restricted in sandboxes
  }
  return null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") {
      if (window.localStorage) {
        localStorage.setItem(key, value);
      }
      if (window.sessionStorage) {
        sessionStorage.setItem(key, value);
      }
    }
  } catch {
    // ignore
  }
}

function removeStorageItem(key: string, legacyKey?: string): void {
  try {
    if (typeof window !== "undefined") {
      if (window.localStorage) {
        localStorage.removeItem(key);
      }
      if (window.sessionStorage) {
        sessionStorage.removeItem(key);
        if (legacyKey) sessionStorage.removeItem(legacyKey);
      }
    }
  } catch {
    // ignore
  }
}

export function getStoredAccessToken(): string | null {
  return memoryAccessToken || getStorageItem(ACCESS_TOKEN_KEY, LEGACY_ACCESS_KEY);
}

export function getStoredRefreshToken(): string | null {
  return memoryRefreshToken || getStorageItem(REFRESH_TOKEN_KEY, LEGACY_REFRESH_KEY);
}

export function getStoredCsrfToken(): string | null {
  return memoryCsrfToken || getStorageItem(CSRF_TOKEN_KEY, LEGACY_CSRF_KEY);
}

export function getStoredUser(): StoredOwner | null {
  if (memoryUser) return memoryUser;
  try {
    const raw = getStorageItem(CACHED_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryUser = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setStoredUser(user: StoredOwner | null): void {
  memoryUser = user;
  if (user) {
    try {
      setStorageItem(CACHED_USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  } else {
    removeStorageItem(CACHED_USER_KEY);
  }
}

export function setStoredAuthTokens(tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
  csrfToken?: string | null;
}) {
  if (tokens.accessToken !== undefined) {
    memoryAccessToken = tokens.accessToken;
    if (tokens.accessToken) setStorageItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    else removeStorageItem(ACCESS_TOKEN_KEY, LEGACY_ACCESS_KEY);
  }
  if (tokens.refreshToken !== undefined) {
    memoryRefreshToken = tokens.refreshToken;
    if (tokens.refreshToken) setStorageItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    else removeStorageItem(REFRESH_TOKEN_KEY, LEGACY_REFRESH_KEY);
  }
  if (tokens.csrfToken !== undefined) {
    memoryCsrfToken = tokens.csrfToken;
    if (tokens.csrfToken) setStorageItem(CSRF_TOKEN_KEY, tokens.csrfToken);
    else removeStorageItem(CSRF_TOKEN_KEY, LEGACY_CSRF_KEY);
  }
}

export function clearStoredAuthTokens() {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  memoryCsrfToken = null;
  memoryUser = null;
  removeStorageItem(ACCESS_TOKEN_KEY, LEGACY_ACCESS_KEY);
  removeStorageItem(REFRESH_TOKEN_KEY, LEGACY_REFRESH_KEY);
  removeStorageItem(CSRF_TOKEN_KEY, LEGACY_CSRF_KEY);
  removeStorageItem(CACHED_USER_KEY);
}

export function readCsrfToken(): string | null {
  const stored = getStoredCsrfToken();
  if (stored) return stored;
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

  const hasSessionTokens = Boolean(
    getStoredRefreshToken() ||
    getStoredAccessToken() ||
    readCsrfToken()
  );

  if (!hasSessionTokens) {
    return Promise.reject(new Error("No active session to refresh"));
  }

  refreshPromise = (async () => {
    try {
      const csrf = readCsrfToken();
      const refreshToken = getStoredRefreshToken();
      const headers: Record<string, string> = {};
      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
      if (refreshToken) {
        headers["X-Refresh-Token"] = refreshToken;
      }
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
      });

      if (!res.ok) {
        clearStoredAuthTokens();
        throw new Error(`Refresh failed with status ${res.status}`);
      }

      try {
        const data = await res.json();
        setStoredAuthTokens({
          accessToken: data.access_token || res.headers.get("x-access-token") || undefined,
          refreshToken: data.refresh_token || res.headers.get("x-refresh-token") || undefined,
          csrfToken: data.csrf_token || res.headers.get("x-csrf-token") || undefined,
        });
      } catch {
        const hAccess = res.headers.get("x-access-token");
        const hRefresh = res.headers.get("x-refresh-token");
        const hCsrf = res.headers.get("x-csrf-token");
        setStoredAuthTokens({
          accessToken: hAccess || undefined,
          refreshToken: hRefresh || undefined,
          csrfToken: hCsrf || undefined,
        });
      }

      return true;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Middleware attaching Authorization and X-CSRF-Token
api.use({
  onRequest({ request }) {
    const accessToken = getStoredAccessToken();
    if (accessToken && !request.headers.has("Authorization")) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const csrf = readCsrfToken();
      if (csrf) {
        request.headers.set("X-CSRF-Token", csrf);
      }
    }
    return request;
  },

  async onResponse({ request, response }) {
    // If response headers contain tokens, persist them
    const hAccess = response.headers.get("x-access-token");
    const hRefresh = response.headers.get("x-refresh-token");
    const hCsrf = response.headers.get("x-csrf-token");
    if (hAccess || hRefresh || hCsrf) {
      setStoredAuthTokens({
        accessToken: hAccess || undefined,
        refreshToken: hRefresh || undefined,
        csrfToken: hCsrf || undefined,
      });
    }

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

        // Retry original request with fresh credentials/headers
        const retryRequest = request.clone();
        const freshToken = getStoredAccessToken();
        if (freshToken) {
          retryRequest.headers.set("Authorization", `Bearer ${freshToken}`);
        }
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

# API consumption

How the frontend talks to the backend. The backend's `references/api-contract.md` is the source of truth. This file is about *consuming* it cleanly.

## Contents
1. Type generation and client
2. Error handling
3. Query keys and hooks
4. Mutations and invalidation
5. Auth, CSRF, and refresh
6. File uploads
7. Polling and freshness
8. MSW handlers for contract-first development

## 1. Type generation and client

```
openapi/openapi.json            # copied from backend export
npm run api:types               # openapi-typescript openapi/openapi.json -o src/shared/api/schema.d.ts
```

```ts
// shared/api/client.ts
import createClient from "openapi-fetch";
import type { paths } from "./schema";

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL, // e.g. /api/v1
  credentials: "include",
});

api.use({
  onRequest({ request }) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      request.headers.set("X-CSRF-Token", readCsrfToken());
    }
    return request;
  },
});
```

Keep one wrapper, `unwrap(result)`, that returns `data` or throws a typed `ApiError`. Features call `unwrap(await api.GET("/monitor"))` inside their hooks only.

## 2. Error handling

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,        // stable machine code from the backend, e.g. "CONTACT_NOT_VERIFIED"
    public detail?: string,
    public fieldErrors?: { field: string; message: string }[],
  ) { super(detail ?? code); }
}
```

- Switch on `code`, never on message text.
- 422 with `errors[]`: map onto react-hook-form fields via `setError`.
- 401: refresh once (single in-flight refresh shared by concurrent requests), retry the original, otherwise redirect to login.
- 403 and 404: show a scoped error component, not a blank page.
- 429: show "Too many attempts, try again in a moment" and disable the control briefly.
- 5xx and network errors: error card with a retry button. Queries retry at most twice with backoff, mutations don't auto-retry.
- A top-level error boundary catches render errors. Do not send raw error objects, tokens, or PII to any error reporter. Scrub before reporting.
- Keep a `codeToMessage` map for known codes so copy lives in one place.

## 3. Query keys and hooks

One `keys.ts` per feature so invalidation is precise.

```ts
// features/loans/keys.ts
export const loanKeys = {
  all: ["loans"] as const,
  list: () => [...loanKeys.all, "list"] as const,
  detail: (id: string) => [...loanKeys.all, "detail", id] as const,
  installments: (id: string) => [...loanKeys.all, id, "installments"] as const,
};

// features/loans/api/useLoanInstallments.ts
export function useLoanInstallments(loanId: string) {
  return useQuery({
    queryKey: loanKeys.installments(loanId),
    queryFn: async () => unwrap(await api.GET("/loans/{id}/installments", { params: { path: { id: loanId } } })),
  });
}
```

Hooks return the query object. Presentation components receive plain props from the page, so they stay easy to test.

## 4. Mutations and invalidation

| Mutation | Invalidate |
|---|---|
| `POST /activity/check-in` | `monitorKeys.all` |
| `POST /loans/{id}/installments/{ym}/mark-paid` | `loanKeys.installments(id)`, `loanKeys.detail(id)`, `monitorKeys.all` (attention list), `notificationKeys.all` |
| `POST/PATCH/DELETE /contacts` | `contactKeys.all`, `monitorKeys.all` |
| `PUT /monitor/config`, `POST/DELETE /monitor/pause` | `monitorKeys.all` |
| `DELETE /packet/shares/{id}` | `packetKeys.shares()` |

Rules:
- Optimistic updates only for check-in and "I paid", with rollback on error and a clear toast.
- Disable the submit control while pending, and send an `Idempotency-Key` for creating mutations (generate one per form mount).
- After a successful mutation, prefer invalidating over hand-patching the cache, unless the screen must update instantly.

## 5. Auth, CSRF, and refresh

- Session cookies are `HttpOnly`, so JavaScript can't read them. That is intentional. The CSRF token comes from a readable cookie or a `/auth/csrf` call, as the backend defines.
- `useCurrentUser()` calls `GET /me` and drives route guards.
- A single `refresh()` promise is shared so parallel 401s don't trigger multiple refreshes.
- Logout clears the Query cache (`queryClient.clear()`) so no data leaks to the next user on a shared device.

## 6. File uploads

- Use `FormData` with the generated path type for the multipart route. Validate size and type in the browser first (the backend still validates).
- Show progress with `XMLHttpRequest` or `fetch` + streams if progress is needed, wrapped in one `useUploadDocument` hook.
- Show the upload constraints before the user picks a file (types, max size).
- On success, invalidate `documentKeys.list()`. On failure, show which file failed and why, and allow retry per file.

## 7. Polling and freshness

- `GET /monitor`: `staleTime` 30s, refetch on window focus, so returning to the tab refreshes the countdown.
- `GET /notifications`: refetch every 15s only while a row is `PENDING`, otherwise on focus.
- `GET /health/scheduler`: checked with the monitor status, no separate polling loop.
- Parent packet queries use `staleTime: Infinity` within the session, with no persistence to storage.

## 8. MSW handlers for contract-first development

- Put handlers in `shared/testing/handlers/`, grouped per feature, typed against the generated schema so they can't drift.
- Provide **factories** (`makeMonitorStatus`, `makeLoan({ emi_paise: 1616600 })`, `makeContact`) with sensible defaults and overrides for each state: `OK`, `WARN_OWNER_2`, `NOTIFY_PARENTS`, `PAUSED`, installment `MISSED`, contact `PENDING`.
- The same handlers serve three jobs: Vitest, Playwright component runs, and `npm run dev:mock` for building screens before the backend exists.
- When the backend isn't ready and a needed field is missing from the contract, add it to the handler **and** raise it as a proposed change to the backend contract. Don't silently diverge.

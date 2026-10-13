---
name: family-safety-net-frontend
description: Build the React + TypeScript frontend for "Family Safety Net", an app that tracks a user's Groww investment activity and a monthly car-loan EMI (Rs 16,166 due on the 24th) and alerts their parents by SMS and email when something is missed. Use this skill whenever the user is working on the web UI for this project: dashboard, "I'm okay" check-in, loan/EMI screens, trusted contacts, documents, emergency-packet preview, the parent-facing OTP-gated packet page, notification log, settings, API client, forms, state management, or frontend tests. Also use it for phrases like "build the UI", "add a screen", "wire this to the API", "continue the frontend", even without naming the skill. Enforces feature-based architecture, SOLID-style component design, contract-first API use, accessibility, and behavior-driven tests. Pair with the family-safety-net-backend skill.
---

# Family Safety Net: frontend guide (React + TypeScript)

This skill is the single source of truth for the frontend. Read this file fully before writing code, then read the reference files at the moment you need them (see section 10).

## 1. What the UI is for

Two audiences, very different needs:

1. **The owner** (mobile first, often on a phone): needs to check in with one tap, see how close they are to an alert, confirm an EMI is paid, and manage trusted contacts and documents. The main emotional goal is *calm confidence*: "the system is watching, I'm covered, nothing needs me right now."
2. **The parent** (public, OTP-gated page opened from an SMS or email, possibly under stress): needs a clear, calm, printable page that says why they were contacted, what to do first, and what information is available. No jargon, no alarm.

The two features it surfaces: **90-day investment inactivity** (Groww stocks and mutual funds) and **monthly car-loan EMI** (Rs 16,166 due on the 24th). Never hardcode those numbers in components. They come from the API.

## 2. Ground rules from the product reality

- Groww gives no "last login" signal, so the **check-in button is the primary activity signal**. Make it the most prominent control on the dashboard and reachable in one tap from a notification link.
- EMI payment is confirmed manually by the owner ("I paid"), so that action must be obvious, fast, and reversible-with-audit, not buried in a menu.
- Parents can't withdraw funds because the owner is inactive. UI copy must **never promise access to money**. Parent-facing wording is "please check on [Name]" first, information second.
- Alerts that reach family are sensitive. Always show the owner what will be sent and to whom (preview-as-parent) before anything goes live.

## 3. Stack (defaults)

React 18 + TypeScript (`strict`, `noUncheckedIndexedAccess`), Vite, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS + shadcn/ui (Radix primitives), `date-fns` + `date-fns-tz`, `openapi-typescript` + `openapi-fetch` for the typed client, Vitest + React Testing Library + MSW, Playwright for a few end-to-end flows, ESLint (typescript-eslint, jsx-a11y, import rules) + Prettier.

Design direction: calm, trustworthy, uncluttered. Generous spacing, one accent color for the primary action, status colors that always have an icon or text label (never color alone). Use the `frontend-design` skill, if present, for typography and visual polish, but keep the tone reassuring rather than flashy.

## 4. Architecture: feature folders, thin pages, typed boundaries

```
frontend/
  openapi/openapi.json          # copied from backend (source of truth)
  src/
    app/                        # providers, router, layout shell, error boundary
    shared/
      api/                      # generated types + configured client + error mapping
      ui/                       # design-system components (Button, Card, StatusPill, MoneyText...)
      hooks/                    # useToast, useMediaQuery, useDebounce
      lib/                      # formatMoneyPaise, dates, masks, cn()
      testing/                  # render helpers, MSW handlers, factories
    features/
      auth/
      dashboard/                # check-in, monitor status
      loans/
      contacts/
      accounts/                 # Groww info + holdings snapshot
      documents/
      packet/                   # owner preview
      notifications/
      settings/
      public-packet/            # parent-facing, separate layout, no owner chrome
        each feature: api/ components/ hooks/ pages/ schemas/ __tests__/
```

Rules:
- **Pages are thin.** A page composes feature components and hooks. It owns routing concerns and layout, not business logic or fetch details.
- **Features don't import from each other.** Share through `shared/` or lift to a parent. ESLint `import/no-restricted-paths` enforces it.
- **All server access goes through the feature's `api/` hooks** (`useMonitorQuery`, `useMarkInstallmentPaid`). Components never call `fetch` or the client directly. Swapping the transport then changes one folder.
- **No business rules in the UI.** The backend decides stages, deadlines, and who is notified. The UI renders what `GET /monitor` says. A tiny amount of derived display logic (for example, progress to day 90) is fine if it uses the API's thresholds.
- One component per file, named exports, props typed with explicit interfaces. Files over about 200 lines get split.

## 5. SOLID translated to React

- **S:** a component renders one thing. Data fetching lives in hooks, formatting in `shared/lib`, validation in zod schemas.
- **O:** extend through props and composition (`<StatusPill tone="warning" />`), not by adding another boolean prop for each new case.
- **L:** variants of a component keep the same contract (any `*Card` accepts the same loading/error handling props pattern).
- **I:** pass components only the props they use. Don't hand a 20-field `Loan` object to a button.
- **D:** components depend on hook interfaces and the typed client, not on concrete HTTP. In tests, MSW stands in for the server. For visual development before the backend exists, run against MSW handlers built from `openapi.json`.

## 6. Contract-first API use

1. Copy the backend's exported `openapi.json` into `openapi/`.
2. `npm run api:types` generates `src/shared/api/schema.d.ts` with `openapi-typescript`. Commit the output.
3. Wrap the typed client once in `shared/api/client.ts` (base URL, credentials: include, CSRF header, error mapping to a typed `ApiError` with `code`).
4. Never hand-write request or response types. If a type is wrong, the backend contract is wrong, so fix the backend skill's `api-contract.md` and re-export.
5. Until the backend is ready, build screens against MSW handlers that return contract-valid data.

Details, query-key conventions, and error handling live in `references/api-consumption.md`.

## 7. State, forms, and display rules

- **Server state:** TanStack Query only. Keys come from a per-feature `keys.ts`. Mutations invalidate precise keys. No copying server data into local state or a global store.
- **UI state:** `useState`/`useReducer`/context. Add a store library only when a real cross-cutting need appears, and tell the user why.
- **Forms:** react-hook-form + zod. Zod schemas mirror backend validation (phone E.164 for India, email, due day 1-31, thresholds where warnings are less than the threshold). Server `errors[]` map back onto fields.
- **Money:** the API sends integer paise. Convert with one helper, `formatPaise(paise)`, using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`. Never do float math on money in the UI.
- **Dates:** render in the owner's timezone (default `Asia/Kolkata`) with `date-fns-tz`. Show relative text for urgency ("due in 3 days") and the absolute date for clarity ("24 Oct").
- **Every async view has four states:** loading (skeletons), empty (explains what to do), error (with retry), and success. Build all four before calling a screen done.
- **Optimistic updates** only for low-risk actions. The check-in and "I paid" buttons should show immediate feedback, but reconcile with the server response and surface failures clearly.

## 8. Accessibility, responsiveness, and security

- Mobile first (360px up). Touch targets at least 44px. The check-in button is reachable with one thumb.
- Semantic HTML, labelled inputs, visible focus, keyboard-operable dialogs (Radix handles this, don't fight it), color contrast AA, status never conveyed by color alone, `aria-live` for toasts and async results. Run `jsx-a11y` lint and `axe` in tests.
- Respect `prefers-reduced-motion`. Support dark mode if time allows, but not at the cost of clarity.
- **Auth:** the session lives in `HttpOnly` cookies. Never store tokens in `localStorage` or `sessionStorage`. Send the CSRF header on mutations. On `401`, refresh once, then redirect to login preserving the intended route.
- **No sensitive data in logs, URLs, analytics, or error reporting.** Mask phone numbers and account ids in the UI by default (`XXXX1234`).
- **Parent packet page:** separate layout, `noindex`, no third-party scripts or analytics, no links that leak the token via `Referer` (`rel="noreferrer"`), clear session expiry state. The backend sets `Cache-Control: no-store`. Don't cache the packet in client storage.
- Add a strict Content-Security-Policy via the hosting config (no inline scripts, no unknown origins).

## 9. Build phases (one at a time, stop at each checkpoint)

At every checkpoint run `tsc --noEmit`, ESLint, Vitest, and (when relevant) Playwright. Then summarize what exists, how to run it, and what is intentionally missing.

0. **Scaffold.** Vite + TS strict, Tailwind, shadcn/ui init, ESLint/Prettier, Vitest + RTL + MSW setup, path aliases, CI. Checkpoint: blank app builds and a smoke test passes.
1. **Foundation.** Router, layout shell, error boundary, API client from `openapi.json`, `ApiError` mapping, `formatPaise`, date helpers, design-system primitives (`Button`, `Card`, `StatusPill`, `EmptyState`, `Skeleton`, `ConfirmDialog`). Storybook is optional.
2. **Auth.** Register, login, MFA enroll/verify, protected routes, session refresh. Read `references/screens-and-flows.md` section "Auth".
3. **Dashboard + check-in.** Monitor status, days-idle ring with 60/80/90 markers, big check-in button, next EMI card, scheduler-health banner, magic-link check-in landing page.
4. **Loans.** Create/edit loan (EMI prefilled as an example, never forced), installment timeline, "I paid" flow with optional reference/note.
5. **Contacts.** Add, verify (consent OTP status), edit, remove, per-contact delivery status.
6. **Accounts and documents.** Groww notes and nominee info, optional holdings snapshot with an "as of" label, encrypted document upload with progress and clear limits.
7. **Packet preview and notifications log.** Preview-as-parent per contact, delivery log with filters and retry state.
8. **Parent-facing packet page.** Token landing, OTP entry, calm printable packet, session expiry handling.
9. **Settings and polish.** Thresholds, grace days, pause monitoring, export/delete data, empty/error states audit, a11y pass, Playwright flows, performance budget (route-level code splitting, image/font hygiene).

## 10. Where to read next

| When you are about to... | Read |
|---|---|
| Build or change any screen, copy, or user flow | `references/screens-and-flows.md` |
| Add API calls, query keys, mutations, error handling | `references/api-consumption.md` |
| Write or review any test | `references/testing.md` |

## 11. Working agreements

- Before each phase, state in 3-5 lines what you will build and which files you will touch. Ask only when blocked on a decision only the user can make (branding, hosting, language). Otherwise pick the default here, say so, and proceed.
- Build the loading, empty, and error states together with the happy path.
- Don't invent endpoints or fields. If the UI needs something the contract lacks, stop and tell the user the backend contract needs a change (`api-contract.md`), then proceed with an MSW handler that matches the proposed shape.
- No `any`, no non-null assertions without a comment, no `useEffect` for data fetching (use TanStack Query), no prop drilling beyond two levels (use composition or context).
- Copy tone: plain, warm, specific. Say exactly what will happen and when ("We'll message Mom and Dad on 21 Jan if we haven't heard from you").
- Conventional commits (`feat(dashboard): add check-in button`), one logical step each.

## 12. Definition of done (any screen or feature)

- [ ] Types come from the generated schema, no hand-written API types
- [ ] Loading, empty, error, and success states all built and tested
- [ ] Works at 360px and 1280px, keyboard-operable, passes axe and `jsx-a11y`
- [ ] Money via `formatPaise`, dates in the owner's timezone
- [ ] No sensitive data in logs, URLs, or client storage
- [ ] Behavior tested with RTL + MSW (user-visible outcomes, not implementation details)
- [ ] Copy reviewed against the "never promise access to funds" rule
- [ ] `tsc`, ESLint, Prettier, and Vitest all pass

## 13. Anti-patterns to refuse

- Calling `fetch` inside components or `useEffect` for server data
- Copying server data into Redux/Zustand/local state "for convenience"
- Hand-written API types that can drift from the backend
- Float math on money, or hardcoded 16166 / 24 / 90 in components
- Business rules in the UI (deciding when an alert fires)
- Storing tokens in `localStorage`
- Status communicated only by color
- Alarming parent-facing copy, or any promise of access to funds
- One giant `Dashboard.tsx` that fetches, formats, validates, and renders everything

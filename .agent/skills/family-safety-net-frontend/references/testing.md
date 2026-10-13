# Frontend testing strategy

Test what the user sees and does, not how the component is built. A good test survives a refactor of the internals.

## Contents
1. Layers and tools
2. Component and page tests
3. Scenarios that must be covered
4. Accessibility tests
5. End-to-end flows
6. Conventions
7. CI gates

## 1. Layers and tools

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | `formatPaise`, date helpers, zod schemas, masks, `codeToMessage` |
| Component/page | Vitest + React Testing Library + MSW | screens with real hooks, mocked network |
| Accessibility | `vitest-axe` + `eslint-plugin-jsx-a11y` | every page-level test runs an axe check |
| E2E | Playwright | 3-4 critical flows against the mock or a seeded backend |

## 2. Component and page tests

- Render through a shared helper `renderWithProviders(ui, { route })` that supplies QueryClient (retries off, fresh per test), Router, and the theme.
- Use MSW handlers from `shared/testing/handlers` with per-test overrides (`server.use(...)`) for error and edge states.
- Query by role and accessible name (`getByRole("button", { name: /i'm okay/i })`). Use `userEvent`, not `fireEvent`.
- Assert user-visible outcomes: text that appears, buttons that become disabled, toasts, navigation. Don't assert on hook calls, internal state, or CSS classes.
- No snapshot tests for whole pages. Small snapshots only for stable, purely presentational output.

## 3. Scenarios that must be covered

**Dashboard**
- Shows loading skeletons, then status text for `OK`, `WARN_OWNER_1`, `WARN_OWNER_2`, `NOTIFY_PARENTS`, `PAUSED`
- Check-in click: button shows pending, success message appears, countdown resets, API called once
- Check-in failure: error message with retry, no false success
- Scheduler unhealthy banner appears when the API says so
- No verified contacts: attention item links to Contacts

**Loans**
- Next EMI card formats `1616600` paise as `₹16,166` and the due date in IST
- "I paid" flow: dialog opens, submit with and without reference, timeline updates, double submit is harmless
- `MISSED` state shows that parents were notified and links to the log
- Edit form validation: due day 1-31, EMI above zero, server 422 errors land on fields

**Contacts**
- Add contact with invalid phone shows an inline error, valid phone normalizes to E.164
- `PENDING` shows resend, `OPTED_OUT` doesn't
- Removing the last verified contact shows the warning dialog

**Settings**
- Warning days must be strictly increasing and below the threshold, with live messages
- Pause date picker enforces the cap and shows the banner after saving

**Parent packet page**
- Invalid or expired token states
- OTP wrong, OTP locked (429), OTP success reveals the packet
- Session expiry mid-read prompts re-verification
- No owner navigation is rendered, and no sensitive data appears before OTP
- Wording check: page never contains copy that promises access to funds (assert the "confirm with the institution" note is present)

**Auth**
- Protected route redirects and returns after login
- 401 triggers a single refresh, then retries the request
- Logout clears cached data

**Cross-cutting**
- Network failure on any query shows the error card with retry, not a blank page
- Money and dates formatting helpers have table-driven unit tests (paise to rupees with Indian digit grouping, IST date boundaries)

## 4. Accessibility tests

- Every page-level test ends with `expect(await axe(container)).toHaveNoViolations()`.
- Dialogs: focus moves in on open and returns to the trigger on close, Escape closes.
- Status pills have text, not only color.
- Form errors are associated with their inputs (`aria-describedby`) and announced.

## 5. End-to-end flows (Playwright)

1. **Owner onboarding to monitoring on:** register, add and verify a contact (mocked OTP), add a loan, preview as parent, turn on monitoring.
2. **Check-in resets the clock:** seed a monitor at day 62, check in, assert the dashboard shows OK.
3. **EMI missed then paid late:** seed a missed installment, assert the missed state, mark paid, assert resolved state.
4. **Parent packet:** open the link, enter OTP, see the packet, download a document, print view renders.

Run in two viewports: 390x844 (mobile) and 1280x800 (desktop). Capture traces on failure.

## 6. Conventions

- Test files live next to the code in `__tests__/` and are named after behavior (`check-in.test.tsx`).
- One behavior per test, arranged as setup, action, assertion. Name tests as sentences ("shows a retry button when the monitor request fails").
- Factories over inline JSON. Randomness and time are controlled (`vi.useFakeTimers`, `vi.setSystemTime`) so date-dependent UI is deterministic.
- Never hit a real network. MSW is configured with `onUnhandledRequest: "error"` so missed handlers fail loudly.

## 7. CI gates

- `tsc --noEmit`, ESLint (including `jsx-a11y`), Prettier check
- Vitest with coverage: features and shared libs at 80%+, report only for the rest
- Playwright flows on pull requests, traces uploaded on failure
- Generated API types must be up to date: CI runs `api:types` and fails on any diff
- Bundle size budget check, and route-level code splitting verified (the parent packet page ships separately from the owner app)

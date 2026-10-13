# Screens, flows, and copy

Reference for every screen. Each screen must ship with loading, empty, error, and success states.

## Contents
1. Navigation and layout
2. Auth
3. Onboarding wizard
4. Dashboard
5. Check-in landing (magic link)
6. Loans
7. Contacts
8. Accounts and documents
9. Packet preview and notifications log
10. Settings
11. Parent-facing packet page
12. Copy guidelines

## 1. Navigation and layout

- Mobile: bottom tab bar with Dashboard, Loan, Contacts, More. Desktop: left sidebar with the same items plus Accounts, Documents, Notifications, Settings.
- Persistent top banner area for system-level problems: scheduler unhealthy, a parent message went `DEAD`, no verified contacts, MFA not enabled. Banners link to the fix.
- The parent-facing route tree (`/p/...`) uses a separate minimal layout with no owner navigation.

## 2. Auth

- Register, login, MFA enroll (QR + manual key, then verify a code), MFA verify on login.
- Protected routes redirect to login and return to the intended page afterwards.
- Session expiry shows a non-destructive prompt to sign in again, preserving unsaved form input where possible.
- Errors: generic wording for failed login. Don't reveal whether an email exists.

## 3. Onboarding wizard

Steps (resumable, progress saved server-side by completing each step's resource):
1. **Trusted contacts:** add at least one parent, send consent OTP, show "waiting for them to confirm".
2. **Groww info:** client id (masked display), nominee details, free-text notes, optional "connect Groww API" toggle (explains the limits honestly: paid subscription, daily approval).
3. **Car loan:** lender, masked account, EMI amount, due day, grace days, payment instructions. Offer the example values (Rs 16,166, 24th) as editable defaults only if the user has none.
4. **Documents:** upload with type hints (nominee proof, folio statements, loan agreement).
5. **Review:** "Preview as [Mom]" showing the exact SMS text, email, and packet. Then "Turn on monitoring".

Do not allow "Turn on monitoring" while there are zero verified contacts. Explain why.

## 4. Dashboard

Top to bottom:
1. **Status header:** plain-language sentence driven by `MonitorStatus.status`, for example "All good. Last check-in 3 days ago." or "It's been 62 days. Please check in so we don't worry your family."
2. **Check-in button:** large, primary, thumb-reachable. On success: confirmation and the countdown resets visibly. On failure: clear retry.
3. **Inactivity ring/bar:** days idle out of `threshold_days`, with tick marks at the warning days. Label what happens at each tick ("Day 80: stronger reminder to you", "Day 90: we message your parents").
4. **Next EMI card:** amount, due date ("Sat 24 Oct, in 13 days"), status pill (`UPCOMING / DUE / PAID / MISSED`), primary action "I paid" when due or upcoming within the reminder window.
5. **Attention list:** anything needing action (unverified contact, failed delivery, MFA off).
6. **Recent activity:** last few notifications and events.

States: loading skeletons for each card independently, empty onboarding prompt if nothing configured, error cards with retry that don't blank the whole page, paused state shows "Monitoring paused until X" with a resume button.

## 5. Check-in landing (magic link)

Route `/checkin/:token`, reachable without login. On load, call the check-in link endpoint once and show: "Thanks, you're checked in. Your 90-day clock has been reset." Handle expired/used links with a clear "This link has expired" and a login link. It must never expose other data.

## 6. Loans

- **List/detail:** lender, masked account, EMI, due day, grace, next due, payment instructions.
- **Installment timeline:** a vertical list by month with status pills and paid dates.
- **"I paid" dialog:** optional reference (UTR/transaction id) and note. Confirm, show success, update the timeline. If already paid, show it as such (idempotent) with no error.
- **Edit loan:** changing the EMI or due day shows an inline note: "This applies from the next installment."
- **Missed state:** make clear that parents have been notified, when, and what they were told, with a link to the notification log. Offer "I paid late" to mark it and trigger the resolved message.

## 7. Contacts

- List with name, relation, masked phone, email, consent status (`PENDING / VERIFIED / OPTED_OUT`), last delivery status.
- Add/edit form: name, relation, phone (India default +91, E.164 normalization), email, priority, language.
- `PENDING` shows "Resend verification". `OPTED_OUT` shows an explanation and no resend option.
- Removing the last verified contact warns that alerts will not reach anyone.
- Parent-facing verification page (`/verify-contact/:token`): explains in two sentences who added them and why, asks for the OTP, offers an opt-out.

## 8. Accounts and documents

- **Groww account:** masked client id, nominee details, notes. Optional holdings snapshot table with an "as of" timestamp and a refresh button when the integration is connected. If the integration expired, show a calm "Reconnect or keep using check-ins" message.
- **Documents:** drag-and-drop and file picker, accepted types and size limit stated before upload, progress, per-file status, delete with confirmation. Say that files are stored encrypted and shared with parents only through a secure link.

## 9. Packet preview and notifications log

- **Preview:** choose a contact, see tabs for SMS, Email, and Packet page exactly as rendered by the backend. Label it clearly "Preview, nothing has been sent".
- **Share management:** list active packet links with expiry and revoke buttons.
- **Notifications log:** table (cards on mobile) with recipient label, channel, template, status, attempts, times. Filters for status, channel, and date. A `DEAD` row explains the failure plainly and links to fixing the contact.

## 10. Settings

- Inactivity: threshold days and warning days with live validation (warnings strictly increasing and below the threshold).
- Loan reminders: grace days, reminder offsets, parent follow-up interval.
- Pause monitoring: date picker with a cap shown, reason optional, clear banner while paused.
- Security: MFA status, active sessions if supported.
- Data: export my data, delete my account (typed confirmation).

## 11. Parent-facing packet page

Flow: `/p/:token` -> "Send me a code" -> OTP entry -> packet.

- Layout: single column, large readable type, printable stylesheet, no navigation chrome, no third-party scripts.
- First screen after OTP, in plain words: why they are receiving this, what the owner asked them to do ("Please try to reach [Name] by phone"), and who else was notified.
- Sections: What happened, First things to do, Investment accounts (masked, nominee, as-of date), Loan (if relevant, with how to pay), Documents (download buttons), Who to contact (Groww support, owner's other contacts).
- Include a visible note: "Claim requirements can change. Please confirm with the institution." Never imply they can access funds.
- Handle: invalid token, expired link, OTP wrong/locked, session expired mid-read (show a re-verify prompt, don't lose the page).
- Print/Save as PDF button using the browser print stylesheet.

## 12. Copy guidelines

- Owner tone: warm, direct, no fear. "We'll let your parents know" not "Your family will be alerted".
- Be specific about dates and recipients: "On 21 Jan we'll message Mom and Dad."
- Parent tone: calm and factual. Never imply emergency without evidence. Avoid words like "missing" or "danger". Use "we haven't been able to confirm [Name] is okay".
- Money always as `₹16,166` (via `formatPaise`), dates like `24 Oct 2026`.
- Error copy says what happened and what to do next, with no jargon or raw error codes.

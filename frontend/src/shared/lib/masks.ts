/**
 * Privacy and security masking helpers for sensitive identifiers.
 * Mask phone numbers and account ids in the UI by default (XXXX1234, +91 98*** **210).
 */

/**
 * Masks an Indian or international phone number for display.
 * Example: +919876543210 -> +91 98*** **210
 * Example: 9876543210 -> +91 98*** **210
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";

  const digits = phone.replace(/\D/g, "");

  // Indian mobile standard (10 digits, or 12 digits starting with 91)
  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    const start = local.slice(0, 2);
    const end = local.slice(-3);
    return `+91 ${start}*** **${end}`;
  }

  if (digits.length === 10) {
    const start = digits.slice(0, 2);
    const end = digits.slice(-3);
    return `+91 ${start}*** **${end}`;
  }

  // Generic international fallback: keep first 3 chars, last 3 digits, mask middle
  if (phone.length > 6) {
    const prefix = phone.slice(0, 3);
    const suffix = phone.slice(-3);
    return `${prefix}****${suffix}`;
  }

  return "••••••••••";
}

/**
 * Masks bank, loan, or investment account numbers.
 * Example: 123456781234 -> XXXX1234
 */
export function maskAccount(account: string | null | undefined): string {
  if (!account) return "—";
  const trimmed = account.trim();
  if (trimmed.length <= 4) return trimmed;
  const last4 = trimmed.slice(-4);
  return `XXXX${last4}`;
}

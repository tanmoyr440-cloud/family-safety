/**
 * Date and timezone formatting utilities for IST (Asia/Kolkata).
 */

const IST_TIMEZONE = "Asia/Kolkata";

const istDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const istShortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  day: "numeric",
  month: "short",
});

const istDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function parseDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  return new Date(input);
}

/**
 * Format date in IST, e.g. "24 Oct 2026".
 */
export function formatISTDate(input: string | number | Date): string {
  const date = parseDate(input);
  if (isNaN(date.getTime())) return "Invalid date";
  return istDateFormatter.format(date);
}

export const formatDateIST = formatISTDate;

/**
 * Format short date in IST, e.g. "24 Oct".
 */
export function formatISTShortDate(input: string | number | Date): string {
  const date = parseDate(input);
  if (isNaN(date.getTime())) return "Invalid date";
  return istShortDateFormatter.format(date);
}

/**
 * Format date and time in IST, e.g. "24 Oct 2026, 09:30 am".
 */
export function formatISTDateTime(input: string | number | Date): string {
  const date = parseDate(input);
  if (isNaN(date.getTime())) return "Invalid date";
  return istDateTimeFormatter.format(date);
}

export const formatDateTimeIST = formatISTDateTime;

/**
 * Format relative text for urgency, e.g. "Due in 3 days", "Due today", "Overdue by 2 days".
 */
export function formatRelativeDueDate(
  dueDateInput: string | number | Date,
  nowInput?: Date,
): string {
  const due = parseDate(dueDateInput);
  const now = nowInput ?? new Date();

  if (isNaN(due.getTime())) return "Invalid due date";

  // Normalize to UTC midnight dates for day comparison
  const utcDue = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const diffDays = Math.round((utcDue - utcNow) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays > 1) return `Due in ${diffDays} days`;
  if (diffDays === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(diffDays)} days`;
}

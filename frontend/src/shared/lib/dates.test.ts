import { describe, it, expect } from "vitest";
import {
  formatISTDate,
  formatISTDateTime,
  formatISTShortDate,
  formatRelativeDueDate,
} from "./dates";

describe("IST date helpers", () => {
  const sampleIso = "2026-10-24T09:30:00+05:30";

  it("formats date in IST", () => {
    const formatted = formatISTDate(sampleIso);
    expect(formatted).toMatch(/24/);
    expect(formatted).toMatch(/Oct/);
    expect(formatted).toMatch(/2026/);
  });

  it("formats short date in IST", () => {
    const formatted = formatISTShortDate(sampleIso);
    expect(formatted).toMatch(/24/);
    expect(formatted).toMatch(/Oct/);
  });

  it("formats date and time in IST", () => {
    const formatted = formatISTDateTime(sampleIso);
    expect(formatted).toMatch(/24/);
    expect(formatted).toMatch(/Oct/);
    expect(formatted).toMatch(/09:30/);
  });

  it("handles invalid dates gracefully", () => {
    expect(formatISTDate("invalid")).toBe("Invalid date");
    expect(formatISTDateTime("invalid")).toBe("Invalid date");
  });
});

describe("formatRelativeDueDate", () => {
  const base = new Date("2026-10-24T10:00:00Z");

  it("returns 'Due today' when dates match", () => {
    expect(formatRelativeDueDate("2026-10-24T18:00:00Z", base)).toBe("Due today");
  });

  it("returns 'Due tomorrow' when 1 day ahead", () => {
    expect(formatRelativeDueDate("2026-10-25T12:00:00Z", base)).toBe("Due tomorrow");
  });

  it("returns 'Due in X days' when multiple days ahead", () => {
    expect(formatRelativeDueDate("2026-10-27T12:00:00Z", base)).toBe("Due in 3 days");
  });

  it("returns 'Overdue by 1 day' when yesterday", () => {
    expect(formatRelativeDueDate("2026-10-23T12:00:00Z", base)).toBe("Overdue by 1 day");
  });

  it("returns 'Overdue by X days' when multiple days late", () => {
    expect(formatRelativeDueDate("2026-10-20T12:00:00Z", base)).toBe("Overdue by 4 days");
  });
});

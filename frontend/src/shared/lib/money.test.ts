import { describe, it, expect } from "vitest";
import { formatPaise, rupeesToPaise } from "./money";

describe("formatPaise", () => {
  it("formats integer paise to INR without decimals when even", () => {
    // Exactly Rs 16,166
    expect(formatPaise(1616600)).toBe("₹16,166");
  });

  it("formats fractional paise with decimals", () => {
    expect(formatPaise(1616650)).toBe("₹16,166.50");
  });

  it("handles zero paise", () => {
    expect(formatPaise(0)).toBe("₹0");
  });

  it("handles non-finite numbers safely", () => {
    expect(formatPaise(NaN)).toBe("₹0");
    expect(formatPaise(Infinity)).toBe("₹0");
  });
});

describe("rupeesToPaise", () => {
  it("converts number rupees to integer paise", () => {
    expect(rupeesToPaise(16166)).toBe(1616600);
  });

  it("converts formatted string rupees to integer paise", () => {
    expect(rupeesToPaise("16,166")).toBe(1616600);
    expect(rupeesToPaise("16166.50")).toBe(1616650);
  });

  it("handles empty or invalid string gracefully", () => {
    expect(rupeesToPaise("")).toBe(0);
    expect(rupeesToPaise("invalid")).toBe(0);
  });
});

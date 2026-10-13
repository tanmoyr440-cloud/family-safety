/**
 * Financial formatting utilities.
 * Handles integer paise values without float math precision errors.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithDecimalsFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format integer paise into Indian Rupee currency representation.
 * E.g. 1616600 -> "₹16,166"
 * If includeDecimals is true: 1616650 -> "₹16,166.50"
 */
export function formatPaise(paise: number, includeDecimals = false): string {
  if (!Number.isFinite(paise)) {
    return "₹0";
  }

  // Convert paise to rupees using integer arithmetic where possible
  const rupees = paise / 100;

  if (includeDecimals || paise % 100 !== 0) {
    return inrWithDecimalsFormatter.format(rupees);
  }

  return inrFormatter.format(rupees);
}

/**
 * Parse a rupee amount string into integer paise.
 * E.g. "16166" -> 1616600
 */
export function rupeesToPaise(rupees: number | string): number {
  const numeric = typeof rupees === "string" ? parseFloat(rupees.replace(/,/g, "")) : rupees;
  if (!Number.isFinite(numeric) || isNaN(numeric)) {
    return 0;
  }
  return Math.round(numeric * 100);
}

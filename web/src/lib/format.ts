/** Indian-format currency and number helpers. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN");

export function formatInr(value: number): string {
  return inr.format(value);
}

/** Compact rupees using lakh/crore conventions: ₹4.8L, ₹1.2Cr. */
export function formatInrCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 1_00_00_000 * 10 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 0 : 1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₹${abs}`;
}

export function formatNumber(value: number): string {
  return num.format(value);
}

export function formatPct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

// app/utils/formatCurrency.ts
export function formatCurrency(value: number | string | null): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? String(value) : String(value);
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseCurrency(formatted: string): number | null {
  if (!formatted) return null;
  const digits = String(formatted).replace(/\D/g, "");
  if (!digits) return null;
  return parseInt(digits, 10);
}
export default formatCurrency;

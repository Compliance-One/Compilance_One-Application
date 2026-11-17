/** Indian digit grouping: 1234567.5 -> ₹12,34,567.50 */
export function formatINR(value: number, withPaise = true): string {
  const n = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(n).toFixed(withPaise ? 2 : 0);
  const [intPart, decPart] = fixed.split('.');
  const negative = n < 0 && Number(fixed) !== 0;

  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `${negative ? '-' : ''}₹${grouped}${decPart ? '.' + decPart : ''}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YY' */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const COMBINING = /[\u0300-\u036F\u0B82\u0BBE-\u0BCD\u0BD7]/;

export function initialOf(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length === 0) return '?';
  let out = chars[0];
  for (let i = 1; i < chars.length && COMBINING.test(chars[i]); i++) out += chars[i];
  return out.toUpperCase();
}

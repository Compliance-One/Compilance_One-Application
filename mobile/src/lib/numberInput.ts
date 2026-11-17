/**
 * Helpers for number text boxes. Keep the raw text in state (so "2." and "0.5"
 * can be typed) and parse it only when you need the number.
 */

/** Keep digits and one decimal point; limit decimals. Accepts Indian comma grouping and ',' typed as decimal. */
export function sanitizeDecimalInput(text: string, maxDecimals = 3): string {
  let s = String(text ?? '').replace(/[^0-9.,]/g, '');
  // A lone comma typed by a keyboard that uses ',' for decimals → treat as '.'.
  if (!s.includes('.') && /,\d{0,2}$/.test(s) && (s.match(/,/g) ?? []).length === 1) {
    s = s.replace(',', '.');
  }
  s = s.replace(/,/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot >= 0) {
    const intPart = s.slice(0, firstDot);
    const decPart = s.slice(firstDot + 1).replace(/\./g, '').slice(0, Math.max(0, maxDecimals));
    s = maxDecimals > 0 ? `${intPart || '0'}.${decPart}` : intPart;
  }
  // Drop leading zeros like "007" but keep "0" and "0.x".
  s = s.replace(/^0+(?=\d)/, '');
  return s;
}

/** Parse a typed decimal; returns 0 for empty or invalid text. */
export function parseDecimal(text: string | number | null | undefined): number {
  if (typeof text === 'number') return Number.isFinite(text) ? text : 0;
  const s = String(text ?? '').replace(/,/g, '').trim();
  if (!s || s === '.') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Number → text for an input box (no trailing zeros, max 3 decimals). */
export function numberToInput(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return String(Math.round(n * 1000) / 1000);
}

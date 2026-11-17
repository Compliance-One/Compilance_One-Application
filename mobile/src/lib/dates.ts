/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return localISODate(dt);
}

export function isOverdue(dueDate: string | null | undefined, today: string, status: string): boolean {
  if (!dueDate) return false;
  if (status === 'PAID' || status === 'CANCELLED') return false;
  return dueDate < today;
}

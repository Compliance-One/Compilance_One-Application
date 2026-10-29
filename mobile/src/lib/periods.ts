import { pad2 } from './format';

export interface Period {
  from: string; // YYYY-MM-DD
  to: string;
}

/** month is 0-11 */
export interface MonthRef {
  year: number;
  month: number;
}

export function thisMonthRef(now: Date = new Date()): MonthRef {
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const total = ref.year * 12 + ref.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function compareMonth(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthRange(ref: MonthRef): Period {
  const lastDay = new Date(ref.year, ref.month + 1, 0).getDate();
  const ym = `${ref.year}-${pad2(ref.month + 1)}`;
  return { from: `${ym}-01`, to: `${ym}-${pad2(lastDay)}` };
}

/** Indian financial year: 1 April to 31 March. */
export function financialYearRange(now: Date = new Date()): Period {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export function monthTitle(ref: MonthRef, monthNames: string[]): string {
  return `${monthNames[ref.month] ?? ''} ${ref.year}`.trim();
}

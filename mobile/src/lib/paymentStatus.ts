import { isOverdue, localISODate } from './dates';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
export type DisplayStatus = PaymentStatus | 'OVERDUE';

export function normalizePaymentStatus(status: string | null | undefined): PaymentStatus {
  const s = String(status ?? 'UNPAID').trim().toUpperCase();
  if (s === 'PAID') return 'PAID';
  if (s === 'PARTIAL') return 'PARTIAL';
  if (s === 'CANCELLED') return 'CANCELLED';
  return 'UNPAID';
}

export function displayPaymentStatus(
  status: string | null | undefined,
  dueDate: string | null | undefined,
  today: string = localISODate()
): DisplayStatus {
  const canonical = normalizePaymentStatus(status);
  if (isOverdue(dueDate, today, canonical)) return 'OVERDUE';
  return canonical;
}

export function paymentStatusFromAmounts(total: number, paid: number): Exclude<PaymentStatus, 'CANCELLED'> {
  if (paid <= 0) return 'UNPAID';
  if (paid + 0.005 >= total) return 'PAID';
  return 'PARTIAL';
}

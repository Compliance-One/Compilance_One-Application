import { accumulateCashBank, normalizePaymentMode } from '../lib/paymentMode';

describe('payment mode and cash/bank', () => {
  it('normalizes aliases', () => {
    expect(normalizePaymentMode('cash')).toBe('CASH');
    expect(normalizePaymentMode('upi')).toBe('UPI');
    expect(normalizePaymentMode('bank_transfer')).toBe('BANK');
  });

  it('computes cash and bank from openings, payments, expenses and paid purchases', () => {
    const result = accumulateCashBank({
      openingCash: 1000,
      openingBank: 5000,
      inflows: [
        { amount: 200, payment_mode: 'CASH' },
        { amount: 300, payment_mode: 'UPI' },
      ],
      outflows: [
        { amount: 50, payment_mode: 'CASH' },
        { amount: 100, payment_mode: 'BANK' },
        { amount: 400, payment_mode: 'BANK' },
      ],
    });
    expect(result.cash).toBe(1150);
    expect(result.bank).toBe(4800);
    expect(result.cashAndBank).toBe(5950);
  });
});

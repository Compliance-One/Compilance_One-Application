export type PaymentMode = 'CASH' | 'BANK' | 'UPI';

export function normalizePaymentMode(value: unknown): PaymentMode {
  const raw = String(value ?? 'CASH').trim().toUpperCase();
  if (raw === 'BANK' || raw === 'UPI' || raw === 'BANK_TRANSFER' || raw === 'CARD') {
    if (raw === 'UPI') return 'UPI';
    return 'BANK';
  }
  return 'CASH';
}

/** UPI credits/debits the bank account for balance-sheet purposes. */
export function isBankLike(mode: PaymentMode): boolean {
  return mode === 'BANK' || mode === 'UPI';
}

export interface CashBankLine {
  amount: number;
  payment_mode?: string | null;
}

export function accumulateCashBank(input: {
  openingCash: number;
  openingBank: number;
  inflows: CashBankLine[];
  outflows: CashBankLine[];
}): { cash: number; bank: number; cashAndBank: number } {
  const split = (rows: CashBankLine[]) => {
    let cash = 0;
    let bank = 0;
    for (const row of rows) {
      const amt = Number(row.amount) || 0;
      if (isBankLike(normalizePaymentMode(row.payment_mode))) bank += amt;
      else cash += amt;
    }
    return { cash, bank };
  };
  const inn = split(input.inflows);
  const out = split(input.outflows);
  const cash = (Number(input.openingCash) || 0) + inn.cash - out.cash;
  const bank = (Number(input.openingBank) || 0) + inn.bank - out.bank;
  return { cash, bank, cashAndBank: cash + bank };
}

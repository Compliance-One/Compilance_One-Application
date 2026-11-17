/**
 * Local balance sheet, matching the Postgres v_balance_sheet view.
 *
 * Cash is opening cash + CASH invoice payments − CASH expenses − paid CASH purchases.
 * Bank is opening bank + BANK/UPI payments − BANK/UPI expenses − paid BANK/UPI purchases.
 * ownersCapital = cash + bank + stock + receivables − payables.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { accumulateCashBank } from '../../lib/paymentMode';
import { OWED_IS_NEGATIVE } from '../../lib/ledger';

export interface BalanceSheet {
  cash: number;
  bank: number;
  cashAndBank: number;
  stockValue: number;
  receivables: number;
  payables: number;
  ownersCapital: number;
}

const RECEIVABLES_SQL = OWED_IS_NEGATIVE
  ? `SELECT SUM(-balance) AS receivables FROM v_customer_balances
     WHERE business_id = ? AND balance < 0`
  : `SELECT SUM(balance) AS receivables FROM v_customer_balances
     WHERE business_id = ? AND balance > 0`;

export async function getBalanceSheet(
  db: SQLiteDatabase,
  businessId: string
): Promise<BalanceSheet> {
  const biz = await db.getFirstAsync<{ opening_cash_balance?: number; opening_bank_balance?: number }>(
    `SELECT opening_cash_balance, opening_bank_balance FROM businesses WHERE id = ?`,
    [businessId]
  );

  const payments = await db.getAllAsync<{ amount: number; payment_mode: string | null }>(
    `SELECT p.amount, p.payment_mode
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.business_id = ?`,
    [businessId]
  );

  const expenses = await db.getAllAsync<{ amount: number; payment_mode: string | null }>(
    `SELECT amount, payment_mode FROM expenses WHERE business_id = ?`,
    [businessId]
  );

  const paidPurchases = await db.getAllAsync<{ amount: number; payment_mode: string | null }>(
    `SELECT amount, payment_mode FROM purchases
     WHERE business_id = ? AND UPPER(COALESCE(payment_status, '')) = 'PAID'`,
    [businessId]
  );

  const { cash, bank, cashAndBank } = accumulateCashBank({
    openingCash: Number(biz?.opening_cash_balance) || 0,
    openingBank: Number(biz?.opening_bank_balance) || 0,
    inflows: payments,
    outflows: [...expenses, ...paidPurchases],
  });

  const stockRow = await db.getFirstAsync<{ stock_value: number | null }>(
    `SELECT SUM(stock_quantity * price) AS stock_value
     FROM products WHERE business_id = ?`,
    [businessId]
  );

  const receivablesRow = await db.getFirstAsync<{ receivables: number | null }>(RECEIVABLES_SQL, [
    businessId,
  ]);

  const payablesRow = await db.getFirstAsync<{ payables: number | null }>(
    `SELECT SUM(amount) AS payables FROM purchases
     WHERE business_id = ? AND UPPER(payment_status) = 'UNPAID'`,
    [businessId]
  );

  const stockValue = stockRow?.stock_value ?? 0;
  const receivables = receivablesRow?.receivables ?? 0;
  const payables = payablesRow?.payables ?? 0;

  return {
    cash,
    bank,
    cashAndBank,
    stockValue,
    receivables,
    payables,
    ownersCapital: cashAndBank + stockValue + receivables - payables,
  };
}

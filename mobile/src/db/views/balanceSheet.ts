/**
 * Local balance sheet, matching the Postgres v_balance_sheet view.
 *
 * KNOWN GAPS (decisions needed from the team):
 *  - There is no cash/bank table, so cashAndBank is always 0 and the UI shows
 *    "not tracked yet" instead of a misleading zero.
 *  - ownersCapital is not real equity. It is stock + receivables - payables.
 *  - Receivables follow the sign convention in lib/ledger.ts.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OWED_IS_NEGATIVE } from '../../lib/ledger';

export interface BalanceSheet {
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

  const cashAndBank = 0; // TODO: no cash/bank table yet
  const stockValue = stockRow?.stock_value ?? 0;
  const receivables = receivablesRow?.receivables ?? 0;
  const payables = payablesRow?.payables ?? 0;

  return {
    cashAndBank,
    stockValue,
    receivables,
    payables,
    ownersCapital: stockValue + receivables - payables,
  };
}

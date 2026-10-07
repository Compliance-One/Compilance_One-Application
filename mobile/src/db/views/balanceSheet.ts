/**
 * Local balance sheet calculation, matching the Postgres v_balance_sheet
 * view added by the a1f4c9d02b7e migration. cashAndBank stays 0 until a
 * cash ledger table exists — this is a known gap, not a bug; raise with
 * the team before relying on it in the UI.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export interface BalanceSheet {
  cashAndBank: number;
  stockValue: number;
  receivables: number;
  payables: number;
  ownersCapital: number;
}

export async function getBalanceSheet(
  db: SQLiteDatabase,
  businessId: string
): Promise<BalanceSheet> {
  const stockRow = await db.getFirstAsync<{ stock_value: number | null }>(
    `SELECT SUM(stock_quantity * price) AS stock_value
     FROM products WHERE business_id = ?`,
    [businessId]
  );

  const receivablesRow = await db.getFirstAsync<{ receivables: number | null }>(
    `SELECT SUM(balance) AS receivables
     FROM v_customer_balances
     WHERE business_id = ? AND balance > 0`,
    [businessId]
  );

  // schema.ts's CHECK constraint uses uppercase ('UNPAID'); normalize
  // with UPPER() in case any data ever comes in lowercase from sync.
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

/**
 * Local equivalent of the Postgres `balance_sheet` view (see
 * backend/app/db/views.sql). Must stay in lockstep with that file.
 *
 * KNOWN GAP — same as the backend side: there is no cash/bank account
 * table in the schema, so cashAndBank is hardcoded to 0 here too. Don't
 * fix this only on one side — if a cash ledger gets added, update both
 * backend/app/db/views.sql and this file together.
 *
 * TODO (integration): swap `db` for whatever Member 1 exports from
 * mobile/src/db/schema.ts.
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
    `SELECT SUM(balance) AS receivables FROM (
       SELECT customer_id, SUM(credit) - SUM(debit) AS balance
       FROM ledger_entries WHERE business_id = ?
       GROUP BY customer_id
     ) WHERE balance > 0`,
    [businessId]
  );

  // Only returns a real number if suppliers/purchases are in use locally too.
  const payablesRow = await db.getFirstAsync<{ payables: number | null }>(
    `SELECT SUM(amount) AS payables FROM purchases
     WHERE business_id = ? AND payment_status = 'unpaid'`,
    [businessId]
  );

  const cashAndBank = 0; // TODO: no cash/bank table yet — see note above
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

/**
 * Queries the v_customer_balances view already defined in
 * mobile/src/db/schema.ts — do not redefine the formula here, this
 * file just reads it. Postgres has the matching view via the
 * a1f4c9d02b7e migration.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export interface CustomerBalance {
  customerId: string;
  balance: number;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  invoiceId: string | null;
  paymentId: string | null;
  debit: number;
  credit: number;
  description: string | null;
  entryDate: string;
  runningBalance: number;
}

export async function getCustomerBalances(
  db: SQLiteDatabase,
  businessId: string
): Promise<CustomerBalance[]> {
  const rows = await db.getAllAsync<{ customer_id: string; balance: number }>(
    `SELECT customer_id, balance
     FROM v_customer_balances
     WHERE business_id = ?
     ORDER BY balance DESC`,
    [businessId]
  );
  return rows.map((r) => ({ customerId: r.customer_id, balance: r.balance }));
}

/**
 * No v_customer_ledger_statement view exists in schema.ts yet, so this
 * stays a raw query (SQLite 3.25+, which Expo bundles, supports the
 * window function). Matches the Postgres v_customer_ledger_statement
 * view added by the a1f4c9d02b7e migration.
 */
export async function getCustomerStatement(
  db: SQLiteDatabase,
  businessId: string,
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<LedgerEntry[]> {
  const rows = await db.getAllAsync<any>(
    `SELECT id, customer_id, invoice_id, payment_id, debit, credit,
            description, entry_date,
            SUM(credit - debit) OVER (
              PARTITION BY customer_id ORDER BY entry_date, id
            ) AS running_balance
     FROM ledger_entries
     WHERE business_id = ?
       AND customer_id = ?
       AND (? IS NULL OR entry_date >= ?)
       AND (? IS NULL OR entry_date <= ?)
     ORDER BY entry_date, id`,
    [businessId, customerId, fromDate ?? null, fromDate ?? null, toDate ?? null, toDate ?? null]
  );

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    invoiceId: r.invoice_id,
    paymentId: r.payment_id,
    debit: r.debit,
    credit: r.credit,
    description: r.description,
    entryDate: r.entry_date,
    runningBalance: r.running_balance,
  }));
}

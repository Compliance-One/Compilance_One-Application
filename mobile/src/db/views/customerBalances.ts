/**
 * Local equivalent of the Postgres `customer_balances` / `customer_ledger_statement`
 * views (see backend/app/db/views.sql). Must stay in lockstep with that file —
 * if the formula changes on one side, change it here too.
 *
 * TODO (integration): swap `db` for whatever Member 1 actually exports from
 * mobile/src/db/schema.ts (likely an expo-sqlite or drizzle-orm instance).
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

/** Current balance for every customer of this business — never cached. */
export async function getCustomerBalances(
  db: SQLiteDatabase,
  businessId: string
): Promise<CustomerBalance[]> {
  const rows = await db.getAllAsync<{ customer_id: string; balance: number }>(
    `SELECT customer_id, SUM(credit) - SUM(debit) AS balance
     FROM ledger_entries
     WHERE business_id = ?
     GROUP BY customer_id
     ORDER BY balance DESC`,
    [businessId]
  );
  return rows.map((r) => ({ customerId: r.customer_id, balance: r.balance }));
}

/** Full running-balance statement for one customer (Ledger screen). */
export async function getCustomerStatement(
  db: SQLiteDatabase,
  businessId: string,
  customerId: string,
  fromDate?: string,
  toDate?: string
): Promise<LedgerEntry[]> {
  // SQLite (3.25+, which Expo bundles) supports window functions, so this
  // mirrors the Postgres `customer_ledger_statement` view exactly.
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

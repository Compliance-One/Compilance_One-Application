/**
 * Member 1 — Local Computed Views
 * mobile/src/db/views/customerBalances.ts
 *
 * Computes running per-customer balance from raw invoices + payments.
 * NEVER stores balance — always computed fresh (no stale-state bugs).
 * Mirrors server-side VBAL Postgres view logic.
 */

import { db } from '../client';
import { sql } from 'drizzle-orm';

export interface CustomerBalance {
  customerId:     string;
  customerName:   string;
  phone:          string | null;
  totalInvoiced:  number;
  totalPaid:      number;
  netBalance:     number;  // positive = customer owes money
}

export interface LedgerRow {
  id:          string;
  entryDate:   string;
  description: string;
  debit:       number;
  credit:      number;
  runningBalance: number;
}

/**
 * Returns net balance for every customer of a business.
 * Called by: Customers screen list, InvoiceCreate credit check.
 */
export async function getCustomerBalances(
  businessId: string,
): Promise<CustomerBalance[]> {
  const rows = await db.all<CustomerBalance>(sql`
    SELECT
      c.id                                          AS customerId,
      c.name                                        AS customerName,
      c.phone                                       AS phone,
      COALESCE(SUM(i.grand_total), 0)               AS totalInvoiced,
      COALESCE(SUM(p.amount),      0)               AS totalPaid,
      COALESCE(SUM(i.grand_total), 0)
        - COALESCE(SUM(p.amount), 0)                AS netBalance
    FROM customers c
    LEFT JOIN invoices i
      ON i.customer_id = c.id
      AND i.business_id = ${businessId}
    LEFT JOIN payments p
      ON p.invoice_id  = i.id
    WHERE c.business_id = ${businessId}
    GROUP BY c.id, c.name, c.phone
    ORDER BY netBalance DESC
  `);
  return rows;
}

/**
 * Returns a running ledger for a single customer.
 * Each row has a computed runningBalance (window-function style in JS).
 * Called by: Ledger screen.
 */
export async function getCustomerLedger(
  businessId: string,
  customerId: string,
): Promise<LedgerRow[]> {
  const rows = await db.all<Omit<LedgerRow, 'runningBalance'>>(sql`
    SELECT
      le.id          AS id,
      le.entry_date  AS entryDate,
      le.description AS description,
      le.debit       AS debit,
      le.credit      AS credit
    FROM ledger_entries le
    WHERE le.business_id = ${businessId}
      AND le.customer_id = ${customerId}
    ORDER BY le.entry_date ASC, le.created_at ASC
  `);

  // Compute running balance in JS (SQLite has no OVER/PARTITION)
  let running = 0;
  return rows.map((r) => {
    running += r.debit - r.credit;
    return { ...r, runningBalance: running };
  });
}

/**
 * Returns single customer net balance.
 * Called by: InvoiceCreate (show credit limit warning).
 */
export async function getSingleCustomerBalance(
  businessId: string,
  customerId: string,
): Promise<number> {
  const result = await db.get<{ balance: number }>(sql`
    SELECT
      COALESCE(SUM(i.grand_total), 0)
        - COALESCE(SUM(p.amount), 0) AS balance
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.business_id = ${businessId}
      AND i.customer_id  = ${customerId}
  `);
  return result?.balance ?? 0;
}

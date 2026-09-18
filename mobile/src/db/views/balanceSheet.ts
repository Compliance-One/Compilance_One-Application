/**
 * Member 1 — Local Computed Views
 * mobile/src/db/views/balanceSheet.ts
 *
 * Computes Balance Sheet: Assets vs Liabilities → Owner's Capital.
 * Fully offline — all computed from raw SQLite rows.
 * Mirrors server-side VBS Postgres view logic.
 */

import { db } from '../client';
import { sql } from 'drizzle-orm';

export interface BalanceSheetReport {
  asOf: string;
  // Assets
  assets: {
    cashAndBank:  number;  // total payments received
    stockValue:   number;  // SUM(products.price * stock_quantity)
    receivables:  number;  // invoiced but not yet paid
    totalAssets:  number;
  };
  // Liabilities
  liabilities: {
    payables:          number; // purchases not yet paid
    totalLiabilities:  number;
  };
  // Equity
  ownersCapital: number;   // Assets - Liabilities
}

/**
 * Returns the balance sheet as of today for the given business.
 * Called by: BalanceSheet screen.
 */
export async function getBalanceSheet(
  businessId: string,
): Promise<BalanceSheetReport> {
  const today = new Date().toISOString().slice(0, 10);

  // Cash & Bank = all payments received
  const cashRow = await db.get<{ cashAndBank: number }>(sql`
    SELECT COALESCE(SUM(p.amount), 0) AS cashAndBank
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.business_id = ${businessId}
  `);

  // Stock value = sum of (price * stock_quantity) for active products
  const stockRow = await db.get<{ stockValue: number }>(sql`
    SELECT COALESCE(SUM(price * stock_quantity), 0) AS stockValue
    FROM products
    WHERE business_id = ${businessId}
      AND is_active = 1
  `);

  // Receivables = invoiced total - payments received (net outstanding)
  const receivablesRow = await db.get<{ receivables: number }>(sql`
    SELECT
      COALESCE(SUM(i.grand_total), 0) - COALESCE(SUM(p.amount), 0) AS receivables
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.business_id = ${businessId}
      AND i.payment_status != 'paid'
  `);

  // Payables = purchases not paid
  const payablesRow = await db.get<{ payables: number }>(sql`
    SELECT COALESCE(SUM(total_amount), 0) AS payables
    FROM purchases
    WHERE business_id = ${businessId}
      AND is_paid = 0
  `);

  const cashAndBank = cashRow?.cashAndBank  ?? 0;
  const stockValue  = stockRow?.stockValue  ?? 0;
  const receivables = Math.max(0, receivablesRow?.receivables ?? 0);
  const totalAssets = cashAndBank + stockValue + receivables;

  const payables         = payablesRow?.payables ?? 0;
  const totalLiabilities = payables;

  return {
    asOf: today,
    assets: {
      cashAndBank,
      stockValue,
      receivables,
      totalAssets,
    },
    liabilities: {
      payables,
      totalLiabilities,
    },
    ownersCapital: totalAssets - totalLiabilities,
  };
}

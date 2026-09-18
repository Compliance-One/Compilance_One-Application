/**
 * Member 1 — Local Computed Views
 * mobile/src/db/views/profitLoss.ts
 *
 * Computes P&L: Sales (invoices) minus Expenses for a date range.
 * Fully offline — reads from local SQLite.
 * Mirrors server-side VPL Postgres view logic.
 */

import { db } from '../client';
import { sql } from 'drizzle-orm';

export interface ProfitLossReport {
  periodFrom:     string;
  periodTo:       string;
  // Income
  grossSales:     number;
  totalDiscount:  number;
  netSales:       number;
  // Expenses
  totalExpenses:  number;
  expenseBreakdown: { category: string; amount: number }[];
  // Result
  netProfit:      number;
  isProfit:       boolean;
}

/**
 * Returns P&L for a given date range.
 * Called by: ProfitLoss screen.
 */
export async function getProfitLoss(
  businessId: string,
  fromDate: string,   // ISO date "YYYY-MM-DD"
  toDate: string,
): Promise<ProfitLossReport> {
  // Sales summary
  const sales = await db.get<{
    grossSales: number;
    totalDiscount: number;
    netSales: number;
  }>(sql`
    SELECT
      COALESCE(SUM(subtotal),      0) AS grossSales,
      COALESCE(SUM(discount),      0) AS totalDiscount,
      COALESCE(SUM(taxable_amount),0) AS netSales
    FROM invoices
    WHERE business_id = ${businessId}
      AND invoice_date BETWEEN ${fromDate} AND ${toDate}
  `);

  // Expense breakdown
  const expenseRows = await db.all<{ category: string; amount: number }>(sql`
    SELECT
      category,
      COALESCE(SUM(amount), 0) AS amount
    FROM expenses
    WHERE business_id = ${businessId}
      AND expense_date BETWEEN ${fromDate} AND ${toDate}
      AND is_active = 1
    GROUP BY category
    ORDER BY amount DESC
  `);

  const totalExpenses = expenseRows.reduce((sum, r) => sum + r.amount, 0);
  const netSales      = sales?.netSales ?? 0;
  const netProfit     = netSales - totalExpenses;

  return {
    periodFrom:       fromDate,
    periodTo:         toDate,
    grossSales:       sales?.grossSales    ?? 0,
    totalDiscount:    sales?.totalDiscount ?? 0,
    netSales,
    totalExpenses,
    expenseBreakdown: expenseRows,
    netProfit,
    isProfit:         netProfit >= 0,
  };
}

/**
 * Local equivalent of the Postgres `pl_income_entries` / `pl_expense_entries`
 * views (see backend/app/db/views.sql). Must stay in lockstep with that file.
 *
 * TODO (integration): swap `db` for whatever Member 1 exports from
 * mobile/src/db/schema.ts.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export interface ProfitAndLoss {
  periodFrom: string;
  periodTo: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
}

export async function getProfitAndLoss(
  db: SQLiteDatabase,
  businessId: string,
  fromDate: string,
  toDate: string
): Promise<ProfitAndLoss> {
  // Pre-tax revenue only — taxable_amount, not total_amount. GST collected
  // is not income, it's money held for the government.
  const incomeRows = await db.getAllAsync<{ category: string; total: number }>(
    `SELECT 'sales' AS category, SUM(taxable_amount) AS total
     FROM invoices
     WHERE business_id = ? AND invoice_date BETWEEN ? AND ?
     GROUP BY category`,
    [businessId, fromDate, toDate]
  );

  const expenseRows = await db.getAllAsync<{ category: string; total: number }>(
    `SELECT category, SUM(amount) AS total
     FROM expenses
     WHERE business_id = ? AND expense_date BETWEEN ? AND ?
     GROUP BY category`,
    [businessId, fromDate, toDate]
  );

  const incomeByCategory: Record<string, number> = {};
  for (const r of incomeRows) incomeByCategory[r.category] = r.total;

  const expenseByCategory: Record<string, number> = {};
  for (const r of expenseRows) expenseByCategory[r.category] = r.total;

  const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);

  return {
    periodFrom: fromDate,
    periodTo: toDate,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    incomeByCategory,
    expenseByCategory,
  };
}

import * as SQLite from 'expo-sqlite';

export interface ProfitLossStatement {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
}

export const getProfitLoss = async (
  db: SQLite.SQLiteDatabase,
  businessId: string,
  startDate: string,
  endDate: string
): Promise<ProfitLossStatement> => {
  const revenueResult = await db.getFirstAsync<{ total_revenue: number | null }>(
    `SELECT COALESCE(SUM(taxable_amount), 0.0) AS total_revenue
     FROM invoices
     WHERE business_id = ? AND invoice_date BETWEEN ? AND ?`,
    [businessId, startDate, endDate]
  );

  const expenseResult = await db.getFirstAsync<{ total_expenses: number | null }>(
    `SELECT COALESCE(SUM(amount), 0.0) AS total_expenses
     FROM expenses
     WHERE business_id = ? AND expense_date BETWEEN ? AND ?`,
    [businessId, startDate, endDate]
  );

  const total_revenue = revenueResult?.total_revenue ?? 0.0;
  const total_expenses = expenseResult?.total_expenses ?? 0.0;

  return {
    total_revenue,
    total_expenses,
    net_profit: total_revenue - total_expenses,
  };
};
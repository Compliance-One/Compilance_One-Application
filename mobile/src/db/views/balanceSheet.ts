import * as SQLite from 'expo-sqlite';

export interface BalanceSheetSummary {
  receivables: number;
  inventory_asset_value: number;
  total_assets: number;
}

export const getBalanceSheetSummary = async (
  db: SQLite.SQLiteDatabase,
  businessId: string
): Promise<BalanceSheetSummary> => {
  // Receivables: Net customer debt owed to the business
  const receivablesResult = await db.getFirstAsync<{ receivables: number | null }>(
    `SELECT COALESCE(SUM(debit - credit), 0.0) AS receivables
     FROM ledger_entries
     WHERE business_id = ?`,
    [businessId]
  );

  // Stock asset value based on product master stock and price
  const stockResult = await db.getFirstAsync<{ inventory_value: number | null }>(
    `SELECT COALESCE(SUM(stock_quantity * price), 0.0) AS inventory_value
     FROM products
     WHERE business_id = ?`,
    [businessId]
  );

  const receivables = receivablesResult?.receivables ?? 0.0;
  const inventory_asset_value = stockResult?.inventory_value ?? 0.0;

  return {
    receivables,
    inventory_asset_value,
    total_assets: receivables + inventory_asset_value,
  };
};
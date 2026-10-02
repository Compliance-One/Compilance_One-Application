import * as SQLite from 'expo-sqlite';

export interface CustomerBalanceRow {
  business_id: string;
  customer_id: string;
  balance: number;
}

export const getCustomerBalances = async (
  db: SQLite.SQLiteDatabase,
  businessId: string
): Promise<CustomerBalanceRow[]> => {
  return await db.getAllAsync<CustomerBalanceRow>(
    `SELECT business_id, customer_id, (SUM(credit) - SUM(debit)) AS balance
     FROM ledger_entries
     WHERE business_id = ?
     GROUP BY business_id, customer_id`,
    [businessId]
  );
};

export const getCustomerRunningStatement = async (
  db: SQLite.SQLiteDatabase,
  customerId: string
): Promise<Array<{
  id: string;
  entry_date: string;
  debit: number;
  credit: number;
  description: string | null;
  running_balance: number;
}>> => {
  return await db.getAllAsync(
    `SELECT 
       id, 
       entry_date, 
       debit, 
       credit, 
       description,
       SUM(credit - debit) OVER (ORDER BY entry_date ASC, id ASC) AS running_balance
     FROM ledger_entries
     WHERE customer_id = ?
     ORDER BY entry_date ASC, id ASC`,
    [customerId]
  );
};
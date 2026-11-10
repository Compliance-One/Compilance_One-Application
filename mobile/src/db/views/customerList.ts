/**
 * Every customer with their current balance (zero if they have no ledger
 * entries yet). Reads the v_customer_balances view from schema.ts.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export interface CustomerBalanceRow {
  customerId: string;
  name: string;
  phone: string | null;
  balance: number;
}

export async function getCustomerBalanceList(
  db: SQLiteDatabase,
  businessId: string
): Promise<CustomerBalanceRow[]> {
  const rows = await db.getAllAsync<{
    customer_id: string;
    name: string;
    phone: string | null;
    balance: number;
  }>(
    `SELECT c.id AS customer_id, c.name, c.phone,
            COALESCE(b.balance, 0) AS balance
     FROM customers c
     LEFT JOIN v_customer_balances b
       ON b.customer_id = c.id AND b.business_id = c.business_id
     WHERE c.business_id = ?
     ORDER BY ABS(COALESCE(b.balance, 0)) DESC, c.name`,
    [businessId]
  );
  return rows.map((r) => ({
    customerId: r.customer_id,
    name: r.name,
    phone: r.phone,
    balance: r.balance,
  }));
}

/**
 * Quick pre-flight numbers for the GSTR-1 screen, so the owner can see what
 * will be exported (and what is missing) before generating the file.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export interface Gstr1Preview {
  totalInvoices: number;
  b2b: number;
  b2c: number;
  taxableValue: number;
  totalTax: number;
  b2bMissingGstin: number;
}

export async function getGstr1Preview(
  db: SQLiteDatabase,
  businessId: string,
  fromDate: string,
  toDate: string
): Promise<Gstr1Preview> {
  const row = await db.getFirstAsync<{
    total: number;
    b2b: number;
    b2c: number;
    taxable: number;
    tax: number;
    missing: number;
  }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN i.invoice_type = 'B2B' THEN 1 ELSE 0 END), 0) AS b2b,
            COALESCE(SUM(CASE WHEN i.invoice_type = 'B2C' THEN 1 ELSE 0 END), 0) AS b2c,
            COALESCE(SUM(i.taxable_amount), 0) AS taxable,
            COALESCE(SUM(i.cgst_amount + i.sgst_amount + i.igst_amount), 0) AS tax,
            COALESCE(SUM(CASE WHEN i.invoice_type = 'B2B'
                               AND (c.gstin IS NULL OR TRIM(c.gstin) = '')
                              THEN 1 ELSE 0 END), 0) AS missing
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ?`,
    [businessId, fromDate, toDate]
  );

  return {
    totalInvoices: row?.total ?? 0,
    b2b: row?.b2b ?? 0,
    b2c: row?.b2c ?? 0,
    taxableValue: row?.taxable ?? 0,
    totalTax: row?.tax ?? 0,
    b2bMissingGstin: row?.missing ?? 0,
  };
}

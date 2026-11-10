/**
 * Sales + GST totals for a period. Mirrors get_dashboard_summary() in
 * backend/app/services/report_aggregator.py.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export interface DashboardSummary {
  totalInvoices: number;
  totalSales: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
}

export async function getDashboardSummary(
  db: SQLiteDatabase,
  businessId: string,
  fromDate: string,
  toDate: string
): Promise<DashboardSummary> {
  const row = await db.getFirstAsync<{
    total_invoices: number;
    total_sales: number;
    taxable_amount: number;
    cgst: number;
    sgst: number;
    igst: number;
  }>(
    `SELECT COUNT(*) AS total_invoices,
            COALESCE(SUM(total_amount), 0) AS total_sales,
            COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
            COALESCE(SUM(cgst_amount), 0) AS cgst,
            COALESCE(SUM(sgst_amount), 0) AS sgst,
            COALESCE(SUM(igst_amount), 0) AS igst
     FROM invoices
     WHERE business_id = ? AND invoice_date BETWEEN ? AND ?`,
    [businessId, fromDate, toDate]
  );

  const cgst = row?.cgst ?? 0;
  const sgst = row?.sgst ?? 0;
  const igst = row?.igst ?? 0;
  return {
    totalInvoices: row?.total_invoices ?? 0,
    totalSales: row?.total_sales ?? 0,
    taxableAmount: row?.taxable_amount ?? 0,
    cgst,
    sgst,
    igst,
    totalGst: cgst + sgst + igst,
  };
}

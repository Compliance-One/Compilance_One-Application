/**
 * Generates a GSTR-1 JSON payload fully offline from local SQLite data.
 * Shape follows the GST portal's offline-tool import format at a basic
 * level (B2B / B2C split with HSN summary) — confirm the exact field
 * names against a real GSTR-1 JSON sample before Review II; the portal's
 * schema is stricter than this starter shape.
 *
 * TODO (integration): swap `db` for whatever Member 1 exports from
 * mobile/src/db/schema.ts.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'B2B' | 'B2C';
  customer_gstin: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

interface HsnRow {
  hsn_code: string;
  gst_rate: number;
  total_quantity: number;
  total_taxable_value: number;
  total_tax: number;
}

export interface Gstr1Export {
  gstin: string;
  period_from: string;
  period_to: string;
  total_invoices: number;
  total_b2b: number;
  total_b2c: number;
  b2b_invoices: InvoiceRow[];
  b2c_invoices: InvoiceRow[];
  hsn_summary: HsnRow[];
  generated_at: string;
}

export async function generateGstr1Json(
  db: SQLiteDatabase,
  businessId: string,
  gstin: string,
  fromDate: string,
  toDate: string
): Promise<Gstr1Export> {
  const invoices = await db.getAllAsync<InvoiceRow>(
    `SELECT i.id, i.invoice_number, i.invoice_date, i.invoice_type,
            c.gstin AS customer_gstin, i.taxable_amount, i.cgst_amount,
            i.sgst_amount, i.igst_amount, i.total_amount
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ?
     ORDER BY i.invoice_date, i.invoice_number`,
    [businessId, fromDate, toDate]
  );

  const b2bInvoices = invoices.filter((inv) => inv.invoice_type === 'B2B');
  const b2cInvoices = invoices.filter((inv) => inv.invoice_type === 'B2C');

  const hsnSummary = await db.getAllAsync<HsnRow>(
    `SELECT ii.hsn_code, ii.gst_rate,
            SUM(ii.quantity) AS total_quantity,
            SUM(ii.taxable_value) AS total_taxable_value,
            SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount) AS total_tax
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ?
     GROUP BY ii.hsn_code, ii.gst_rate
     ORDER BY ii.hsn_code`,
    [businessId, fromDate, toDate]
  );

  return {
    gstin,
    period_from: fromDate,
    period_to: toDate,
    total_invoices: invoices.length,
    total_b2b: b2bInvoices.length,
    total_b2c: b2cInvoices.length,
    b2b_invoices: b2bInvoices,
    b2c_invoices: b2cInvoices,
    hsn_summary: hsnSummary,
    generated_at: new Date().toISOString(),
  };
}

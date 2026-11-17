/**
 * GSTR-1 summary JSON in the flat shape the reviewers asked for:
 * { gstin, period_from, period_to, totals, b2b_invoices, b2c_invoices, hsn_summary, generated_at }.
 * B2B = the customer has a GSTIN. All amounts are plain numbers.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export interface SimpleInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_gstin: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface SimpleItemRow {
  hsn_code: string | null;
  gst_rate: number;
  quantity: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

export interface SimpleGstr1Invoice {
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

export interface SimpleGstr1 {
  gstin: string;
  period_from: string;
  period_to: string;
  total_invoices: number;
  total_b2b: number;
  total_b2c: number;
  b2b_invoices: SimpleGstr1Invoice[];
  b2c_invoices: SimpleGstr1Invoice[];
  hsn_summary: Array<{
    hsn_code: string;
    gst_rate: number;
    total_quantity: number;
    total_taxable_value: number;
    total_tax: number;
  }>;
  generated_at: string;
}

/** Remove float noise (0.1+0.2) without hiding real fractions like 1.1875. */
const num = (n: unknown): number => Math.round((Number(n) || 0) * 10000) / 10000;

export function buildSimpleGstr1(
  invoices: SimpleInvoiceRow[],
  items: SimpleItemRow[],
  gstin: string,
  periodFrom: string,
  periodTo: string,
  now: Date = new Date()
): SimpleGstr1 {
  const b2b: SimpleGstr1Invoice[] = [];
  const b2c: SimpleGstr1Invoice[] = [];
  for (const r of invoices) {
    const g = (r.customer_gstin ?? '').trim().toUpperCase();
    const inv: SimpleGstr1Invoice = {
      id: String(r.id),
      invoice_number: String(r.invoice_number),
      invoice_date: String(r.invoice_date).slice(0, 10),
      invoice_type: g ? 'B2B' : 'B2C',
      customer_gstin: g || null,
      taxable_amount: num(r.taxable_amount),
      cgst_amount: num(r.cgst_amount),
      sgst_amount: num(r.sgst_amount),
      igst_amount: num(r.igst_amount),
      total_amount: num(r.total_amount),
    };
    (g ? b2b : b2c).push(inv);
  }

  const hsn = new Map<string, { hsn_code: string; gst_rate: number; q: number; tv: number; tax: number }>();
  for (const it of items) {
    const code = (it.hsn_code ?? '').trim() || 'NA';
    const rate = num(it.gst_rate);
    const key = `${code}|${rate}`;
    const cur = hsn.get(key) ?? { hsn_code: code, gst_rate: rate, q: 0, tv: 0, tax: 0 };
    cur.q += Number(it.quantity) || 0;
    cur.tv += Number(it.taxable_value) || 0;
    cur.tax += (Number(it.cgst_amount) || 0) + (Number(it.sgst_amount) || 0) + (Number(it.igst_amount) || 0);
    hsn.set(key, cur);
  }
  const hsn_summary = [...hsn.values()]
    .sort((a, b) => a.hsn_code.localeCompare(b.hsn_code) || a.gst_rate - b.gst_rate)
    .map((h) => ({
      hsn_code: h.hsn_code,
      gst_rate: h.gst_rate,
      total_quantity: num(h.q),
      total_taxable_value: num(h.tv),
      total_tax: num(h.tax),
    }));

  return {
    gstin: gstin ?? '',
    period_from: periodFrom,
    period_to: periodTo,
    total_invoices: b2b.length + b2c.length,
    total_b2b: b2b.length,
    total_b2c: b2c.length,
    b2b_invoices: b2b,
    b2c_invoices: b2c,
    hsn_summary,
    generated_at: now.toISOString(),
  };
}

export async function generateSimpleGstr1(
  db: SQLiteDatabase,
  businessId: string,
  gstin: string,
  from: string,
  to: string
): Promise<SimpleGstr1> {
  const invoices = await db.getAllAsync<SimpleInvoiceRow>(
    `SELECT i.id, i.invoice_number, i.invoice_date, c.gstin AS customer_gstin,
            i.taxable_amount, i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_amount
     FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ? AND UPPER(i.payment_status) != 'CANCELLED'
     ORDER BY i.invoice_date, i.invoice_number`,
    [businessId, from, to]
  );
  const items = await db.getAllAsync<SimpleItemRow>(
    `SELECT ii.hsn_code, ii.gst_rate, ii.quantity, ii.taxable_value, ii.cgst_amount, ii.sgst_amount, ii.igst_amount
     FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ? AND UPPER(i.payment_status) != 'CANCELLED'`,
    [businessId, from, to]
  );
  return buildSimpleGstr1(invoices, items, gstin, from, to);
}

import { buildSimpleGstr1 } from '../gstr1/simpleGstr1';

const base = { taxable_amount: 100, cgst_amount: 9, sgst_amount: 9, igst_amount: 0, total_amount: 118 };

describe('buildSimpleGstr1', () => {
  const out = buildSimpleGstr1(
    [
      { id: 'a', invoice_number: 'CO-26/0001', invoice_date: '2026-11-15', customer_gstin: '27aabcb9876q1zb', ...base },
      { id: 'b', invoice_number: 'CO-26/0002', invoice_date: '2026-11-16', customer_gstin: null, ...base, taxable_amount: 47.5, cgst_amount: 1.1875, sgst_amount: 1.1875, total_amount: 50 },
      { id: 'c', invoice_number: 'CO-26/0003', invoice_date: '2026-11-17', customer_gstin: '  ', ...base },
    ],
    [
      { hsn_code: '84818030', gst_rate: 18, quantity: 10, taxable_value: 1000, cgst_amount: 90, sgst_amount: 90, igst_amount: 0 },
      { hsn_code: '84818030', gst_rate: 18, quantity: 10, taxable_value: 1000, cgst_amount: 90, sgst_amount: 90, igst_amount: 0 },
      { hsn_code: '5648', gst_rate: 5, quantity: 1, taxable_value: 47.5, cgst_amount: 1.1875, sgst_amount: 1.1875, igst_amount: 0 },
      { hsn_code: null, gst_rate: 0, quantity: 2, taxable_value: 60, cgst_amount: 0, sgst_amount: 0, igst_amount: 0 },
    ],
    '27AABCA1234F1Z5',
    '2026-11-01',
    '2026-11-30',
    new Date('2026-11-15T02:31:05.557Z')
  );

  it('has exactly the requested top-level keys', () => {
    expect(Object.keys(out)).toEqual([
      'gstin', 'period_from', 'period_to', 'total_invoices', 'total_b2b', 'total_b2c',
      'b2b_invoices', 'b2c_invoices', 'hsn_summary', 'generated_at',
    ]);
    expect(out.generated_at).toBe('2026-11-15T02:31:05.557Z');
  });

  it('splits B2B (customer has GSTIN) from B2C', () => {
    expect(out.total_invoices).toBe(3);
    expect(out.total_b2b).toBe(1);
    expect(out.total_b2c).toBe(2);
    expect(out.b2b_invoices[0]).toEqual({
      id: 'a', invoice_number: 'CO-26/0001', invoice_date: '2026-11-15', invoice_type: 'B2B',
      customer_gstin: '27AABCB9876Q1ZB', taxable_amount: 100, cgst_amount: 9, sgst_amount: 9, igst_amount: 0, total_amount: 118,
    });
    expect(out.b2c_invoices.every((i) => i.invoice_type === 'B2C' && i.customer_gstin === null)).toBe(true);
    expect(out.b2c_invoices[0].cgst_amount).toBe(1.1875);
  });

  it('summarises HSN by code and rate with numeric totals', () => {
    expect(out.hsn_summary).toEqual([
      { hsn_code: '5648', gst_rate: 5, total_quantity: 1, total_taxable_value: 47.5, total_tax: 2.375 },
      { hsn_code: '84818030', gst_rate: 18, total_quantity: 20, total_taxable_value: 2000, total_tax: 360 },
      { hsn_code: 'NA', gst_rate: 0, total_quantity: 2, total_taxable_value: 60, total_tax: 0 },
    ]);
  });
});

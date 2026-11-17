import { buildDocIssue, buildGstr1Payload, fpOf, mapUqc, money } from '../gstr1/generateGstr1';
import { validateGstr1 } from '../gstr1/validateGstr1';

const GSTIN = '33AAAAA0000A1Z5';
const BUYER = '29BBBBB0000B1Z3';

describe('fp and money helpers', () => {
  it('formats the filing period as MMYYYY', () => {
    expect(fpOf('2026-11-01')).toBe('112026');
    expect(fpOf('2026-04-01')).toBe('042026');
  });

  it('rounds money to 2 decimals (half up)', () => {
    expect(money(10.005)).toBe(10.01);
    expect(money(10.004)).toBe(10);
  });

  it('maps units to 3-letter UQC codes', () => {
    expect(mapUqc('kg')).toBe('KGS');
    expect(mapUqc('pcs')).toBe('NOS');
    expect(mapUqc('unknown-unit')).toBe('OTH');
  });
});

describe('GSTR-1 payload vs published GSTN shape', () => {
  it('builds b2b, b2cs, split HSN, doc_issue and passes the structural validator', () => {
    const file = buildGstr1Payload(
      [
        {
          id: 'inv-b2b',
          invoice_number: 'CO-26/0001',
          invoice_date: '2026-11-05',
          invoice_type: 'B2B',
          total_amount: 118,
          customer_gstin: BUYER,
          customer_state: '29',
          seller_state: '33',
        },
        {
          id: 'inv-b2c',
          invoice_number: 'CO-26/0002',
          invoice_date: '2026-11-06',
          invoice_type: 'B2C',
          total_amount: 105,
          customer_gstin: null,
          customer_state: '33',
          seller_state: '33',
        },
      ],
      [
        {
          invoice_id: 'inv-b2b',
          hsn_code: '7408',
          unit: 'KG',
          quantity: 1,
          gst_rate: 18,
          taxable_value: 100,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 18,
        },
        {
          invoice_id: 'inv-b2c',
          hsn_code: '1001',
          unit: 'PCS',
          quantity: 2,
          gst_rate: 5,
          taxable_value: 100,
          cgst_amount: 2.5,
          sgst_amount: 2.5,
          igst_amount: 0,
        },
      ],
      [
        { invoice_number: 'CO-26/0001', payment_status: 'PAID' },
        { invoice_number: 'CO-26/0002', payment_status: 'UNPAID' },
        { invoice_number: 'CO-26/0003', payment_status: 'CANCELLED' },
      ],
      GSTIN,
      '2026-11-01'
    );

    expect(file.fp).toBe('112026');
    expect(file.payload.gstin).toBe(GSTIN);
    const result = validateGstr1(file.payload);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);

    const b2b = file.payload.b2b as Array<{ ctin: string; inv: Array<{ pos: string; idt: string }> }>;
    expect(b2b[0].ctin).toBe(BUYER);
    expect(b2b[0].inv[0].pos).toBe('29');
    expect(b2b[0].inv[0].idt).toBe('05-11-2026');

    const b2cs = file.payload.b2cs as Array<{ sply_ty: string; pos: string }>;
    expect(b2cs[0].sply_ty).toBe('INTRA');
    expect(b2cs[0].pos).toBe('33');

    const hsn = file.payload.hsn as { hsn_b2b: Array<{ hsn_sc: string; uqc: string }>; hsn_b2c: Array<{ hsn_sc: string; uqc: string }> };
    expect(hsn.hsn_b2b[0].hsn_sc).toBe('7408');
    expect(hsn.hsn_b2b[0].uqc).toBe('KGS');
    expect(hsn.hsn_b2c[0].hsn_sc).toBe('1001');
    expect(hsn.hsn_b2c[0].uqc).toBe('NOS');

    const docs = (file.payload.doc_issue as { doc_det: Array<{ docs: Array<{ totnum: number; cancel: number; net_issue: number }> }> })
      .doc_det[0].docs[0];
    expect(docs.totnum).toBe(3);
    expect(docs.cancel).toBe(1);
    expect(docs.net_issue).toBe(2);
  });

  it('puts interstate B2C invoices over ₹1 lakh in b2cl', () => {
    const file = buildGstr1Payload(
      [
        {
          id: 'big',
          invoice_number: 'INV-9',
          invoice_date: '2026-11-10',
          invoice_type: 'B2C',
          total_amount: 150000,
          customer_gstin: null,
          customer_state: '29',
          seller_state: '33',
        },
      ],
      [
        {
          invoice_id: 'big',
          hsn_code: '1001',
          unit: 'BAG',
          quantity: 10,
          gst_rate: 5,
          taxable_value: 142857.14,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 7142.86,
        },
      ],
      [{ invoice_number: 'INV-9', payment_status: 'UNPAID' }],
      GSTIN,
      '2026-11-01'
    );
    expect(file.payload.b2cl).toBeDefined();
    expect(file.payload.b2cs).toBeUndefined();
    expect(validateGstr1(file.payload).ok).toBe(true);
  });

  it('rejects an invalid fp or missing doc_issue', () => {
    const badFp = validateGstr1({ gstin: GSTIN, fp: '202611', hsn: { hsn_b2b: [], hsn_b2c: [] }, doc_issue: { doc_det: [] } });
    expect(badFp.ok).toBe(false);
    expect(badFp.issues.some((i) => i.path === 'fp')).toBe(true);

    const noDocs = validateGstr1({ gstin: GSTIN, fp: '112026', hsn: { hsn_b2b: [], hsn_b2c: [] } });
    expect(noDocs.issues.some((i) => i.path === 'doc_issue')).toBe(true);
  });
});

describe('buildDocIssue', () => {
  it('groups a numbering series and counts cancellations', () => {
    const block = buildDocIssue([
      { invoice_number: 'A-1', payment_status: 'PAID' },
      { invoice_number: 'A-3', payment_status: 'CANCELLED' },
      { invoice_number: 'A-2', payment_status: 'UNPAID' },
    ]) as { doc_det: Array<{ docs: Array<{ from: string; to: string; totnum: number; cancel: number; net_issue: number }> }> };
    const row = block.doc_det[0].docs[0];
    expect(row.from).toBe('A-1');
    expect(row.to).toBe('A-3');
    expect(row.totnum).toBe(3);
    expect(row.cancel).toBe(1);
    expect(row.net_issue).toBe(2);
  });
});

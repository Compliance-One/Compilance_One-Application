import { buildReceipt, receiptToText, columnsFor } from '../print/receiptFormatter';
import { sampleInvoice } from '../billing/sampleInvoice';

describe('receiptFormatter', () => {
  it('uses 32 columns for 58mm and 48 for 80mm', () => {
    expect(columnsFor(58)).toBe(32);
    expect(columnsFor(80)).toBe(48);
    expect(buildReceipt(sampleInvoice(), 80).cols).toBe(48);
  });

  it('includes business header, GSTIN, items and IGST for inter-state invoices', () => {
    const text = receiptToText(buildReceipt(sampleInvoice(), 58));
    expect(text).toContain('TAX INVOICE');
    expect(text).toContain('My Business');
    expect(text).toContain('33AAAAA0000A1Z5');
    expect(text).toContain('CO-26/0001');
    expect(text).toContain('Bangalore Precision Forge');
    expect(text).toContain('29AACCH5678Q1Z2');
    expect(text).toContain('UltraTech Super Cement');
    expect(text).toContain('HSN 252329');
    expect(text).toMatch(/IGST/);
    expect(text).not.toMatch(/CGST/);
    expect(text).toContain('16,520.00');
    expect(text).toContain('Rupees Sixteen Thousand Five Hundred Twenty only');
    expect(text).toContain('[CUT]');
  });

  it('prints CGST and SGST for intra-state invoices', () => {
    const intra = sampleInvoice({
      placeOfSupplyCode: '33',
      placeOfSupplyName: 'Tamil Nadu',
      cgstAmount: 1260,
      sgstAmount: 1260,
      igstAmount: 0,
      buyer: {
        id: 'c2',
        name: 'Local Store',
        gstin: '33BBBBB0000B1Z1',
        stateCode: '33',
        stateName: 'Tamil Nadu',
      },
      items: [
        {
          id: 'i1',
          name: 'Havells Modular Switch 10A',
          hsnCode: '853650',
          quantity: 50,
          unit: 'PCS',
          unitPrice: 140,
          discount: 0,
          gstRate: 18,
          taxableValue: 7000,
          cgstAmount: 630,
          sgstAmount: 630,
          igstAmount: 0,
          lineTotal: 8260,
        },
      ],
    });
    const text = receiptToText(buildReceipt(intra, 58));
    expect(text).toMatch(/CGST/);
    expect(text).toMatch(/SGST/);
    expect(text).not.toMatch(/IGST/);
  });

  it('emits ESC/POS init, text and a cut command', () => {
    const { bytes } = buildReceipt(sampleInvoice(), 58);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(bytes.length).toBeGreaterThan(40);
    // GS V 0
    const asArr = Array.from(bytes);
    let foundCut = false;
    for (let i = 0; i < asArr.length - 2; i++) {
      if (asArr[i] === 0x1d && asArr[i + 1] === 0x56 && asArr[i + 2] === 0x00) foundCut = true;
    }
    expect(foundCut).toBe(true);
  });
});

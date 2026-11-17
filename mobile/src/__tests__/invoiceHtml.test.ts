import { buildInvoiceHtml } from '../pdf/invoiceHtml';
import { amountInWords } from '../lib/amountInWords';
import { sampleInvoice } from '../billing/sampleInvoice';

describe('buildInvoiceHtml', () => {
  it('includes the mandatory GST invoice fields', () => {
    const html = buildInvoiceHtml(sampleInvoice());
    expect(html).toContain('TAX INVOICE');
    expect(html).toContain('My Business');
    expect(html).toContain('12 Anna Salai, Chennai');
    expect(html).toContain('33AAAAA0000A1Z5');
    expect(html).toContain('CO-26/0001');
    expect(html).toContain('17-11-2026');
    expect(html).toContain('Bangalore Precision Forge');
    expect(html).toContain('29AACCH5678Q1Z2');
    expect(html).toContain('Place of Supply');
    expect(html).toContain('Karnataka');
    expect(html).toContain('252329');
    expect(html).toContain('Taxable value');
    expect(html).toContain('IGST');
    expect(html).toContain(amountInWords(16520));
    expect(html).toContain('Authorised Signatory');
    expect(html).toContain('Reverse Charge');
  });

  it('escapes HTML in names', () => {
    const html = buildInvoiceHtml(
      sampleInvoice({
        seller: {
          id: 'b1',
          name: 'A & B <Traders>',
          gstin: '33AAAAA0000A1Z5',
          stateCode: '33',
          stateName: 'Tamil Nadu',
        },
      })
    );
    expect(html).toContain('A &amp; B &lt;Traders&gt;');
    expect(html).not.toContain('A & B <Traders>');
  });

  it('flags a missing B2B GSTIN', () => {
    const html = buildInvoiceHtml(
      sampleInvoice({
        buyer: {
          id: 'c9',
          name: 'Unnamed firm',
          gstin: '',
          stateCode: '29',
          stateName: 'Karnataka',
        },
      })
    );
    expect(html).toContain('Missing (required for B2B)');
  });
});

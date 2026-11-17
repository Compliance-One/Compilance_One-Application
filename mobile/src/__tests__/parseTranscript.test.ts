import { parseNumberPhrase, parseTranscript } from '../voice/parseTranscript';

const products = [
  { id: 'p1', name: 'UltraTech Super Cement (50kg)', sku: 'UTC-50', hsnCode: '252329', unit: 'BAG', sellingPrice: 375, taxRate: 28 },
  { id: 'p2', name: 'Havells Modular Switch 10A', sku: 'HAV-10A', hsnCode: '853650', unit: 'PCS', sellingPrice: 140, taxRate: 18 },
  { id: 'p3', name: 'Berger Interior Emulsion (4L)', sku: 'BRG-4L', hsnCode: '320910', unit: 'CAN', sellingPrice: 920, taxRate: 18 },
  { id: 'p4', name: 'Drywall Screws (Box of 500)', sku: 'SCR-500', hsnCode: '731815', unit: 'BOX', sellingPrice: 150, taxRate: 18 },
];

const customers = [
  { id: 'c1', name: 'Rajesh Enterprises', gstin: '', stateCode: '33', stateName: 'Tamil Nadu' },
];

describe('parseNumberPhrase', () => {
  it('parses digits', () => {
    expect(parseNumberPhrase(['12'])).toEqual({ value: 12, consumed: 1 });
  });

  it('parses English number words', () => {
    expect(parseNumberPhrase(['five'])?.value).toBe(5);
    expect(parseNumberPhrase(['twenty', 'five'])?.value).toBe(25);
    expect(parseNumberPhrase(['twenty-five'])?.value).toBe(25);
    expect(parseNumberPhrase(['one', 'hundred', 'forty'])?.value).toBe(140);
    expect(parseNumberPhrase(['two', 'thousand'])?.value).toBe(2000);
  });

  it('parses Tamil number words', () => {
    expect(parseNumberPhrase(['பத்து'])?.value).toBe(10);
    expect(parseNumberPhrase(['இருபத்து', 'ஐந்து'])?.value).toBe(25);
    expect(parseNumberPhrase(['நூறு'])?.value).toBe(100);
  });
});

describe('parseTranscript', () => {
  it('parses quantity, unit, product, price and GST rate', () => {
    const bill = parseTranscript(
      '5 bags UltraTech Cement at 380 each with 28 percent GST',
      { products }
    );
    expect(bill.items).toHaveLength(1);
    expect(bill.items[0].quantity).toBe(5);
    expect(bill.items[0].unit).toBe('BAG');
    expect(bill.items[0].unitPrice).toBe(380);
    expect(bill.items[0].taxRate).toBe(28);
    expect(bill.items[0].productId).toBe('p1');
    expect(bill.items[0].hsnCode).toBe('252329');
  });

  it('parses English number words and multiple items', () => {
    const bill = parseTranscript(
      'twelve pieces Havells switch at one hundred forty and ten cans Berger emulsion at 920',
      { products }
    );
    expect(bill.items).toHaveLength(2);
    expect(bill.items[0].quantity).toBe(12);
    expect(bill.items[0].productId).toBe('p2');
    expect(bill.items[0].unitPrice).toBe(140);
    expect(bill.items[1].quantity).toBe(10);
    expect(bill.items[1].productId).toBe('p3');
  });

  it('extracts a spoken customer name and fuzzy-matches the catalog', () => {
    const bill = parseTranscript(
      'Invoice for Rajesh Enterprises, 5 bags UltraTech Cement at 380 each',
      { products, customers }
    );
    expect(bill.customerName).toBe('Rajesh Enterprises');
    expect(bill.customer?.id).toBe('c1');
    expect(bill.items[0].productId).toBe('p1');
  });

  it('parses Tamil quantity, unit and rupee price', () => {
    const bill = parseTranscript('பத்து பை சிமெண்ட் 380 ரூபாய்');
    expect(bill.items).toHaveLength(1);
    expect(bill.items[0].quantity).toBe(10);
    expect(bill.items[0].unit).toBe('BAG');
    expect(bill.items[0].name).toMatch(/சிமெண்ட்/);
    expect(bill.items[0].unitPrice).toBe(380);
  });

  it('falls back to catalog price and tax when they are not spoken', () => {
    const bill = parseTranscript('12 pieces Havells switch', { products });
    expect(bill.items[0].unitPrice).toBe(140);
    expect(bill.items[0].taxRate).toBe(18);
  });

  it('fuzzy-matches a short spoken name to a catalog product', () => {
    const bill = parseTranscript('4 boxes dry screws at 150', { products });
    expect(bill.items[0].productId).toBe('p4');
    expect(bill.items[0].unit).toBe('BOX');
  });
});

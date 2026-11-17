import { parseTranscript, nameVariants } from '../voice/parseTranscript';

const products = [
  { id: 'r', name: 'Rice (Ponni)', unit: 'KG', sellingPrice: 58, taxRate: 0, hsnCode: '1006' },
  { id: 's', name: 'Sugar', unit: 'KG', sellingPrice: 44, taxRate: 5, hsnCode: '1701' },
  { id: 'o', name: 'கடலை எண்ணெய்', unit: 'LTR', sellingPrice: 180, taxRate: 5, hsnCode: '1508' },
];

describe('structured voice billing', () => {
  it('parses English with commas: "2 kilo arisi 60 rupees, 1 sugar 45"', () => {
    const bill = parseTranscript('2 kilo arisi 60 rupees, 1 sugar 45', { products });
    expect(bill.items).toHaveLength(2);
    expect(bill.items[0]).toMatchObject({ productId: 'r', quantity: 2, unit: 'KG', unitPrice: 60, hsnCode: '1006' });
    expect(bill.items[1]).toMatchObject({ productId: 's', quantity: 1, unitPrice: 45, taxRate: 5 });
  });

  it('splits items when the recogniser drops commas', () => {
    const bill = parseTranscript('2 kilo rice 60 1 sugar 45');
    expect(bill.items.map((i) => [i.name, i.quantity, i.unitPrice])).toEqual([
      ['rice', 2, 60],
      ['sugar', 1, 45],
    ]);
  });

  it('understands Tamil numbers written in English letters', () => {
    const bill = parseTranscript('rendu kilo arisi aruvathu rupai', { products });
    expect(bill.items[0]).toMatchObject({ productId: 'r', quantity: 2, unit: 'KG', unitPrice: 60 });
  });

  it('understands Tamil script numbers, units and half quantities', () => {
    const bill = parseTranscript('அரை கிலோ சர்க்கரை இருபத்து ரூபாய், ஒரு லிட்டர் எண்ணெய்', { products });
    expect(bill.items[0]).toMatchObject({ productId: 's', quantity: 0.5, unit: 'KG', unitPrice: 20 });
    expect(bill.items[1]).toMatchObject({ productId: 'o', quantity: 1, unit: 'LTR', unitPrice: 180 });
  });

  it('keeps unknown items as quick lines with 0% GST', () => {
    const bill = parseTranscript('3 ennam soap 25', { products });
    expect(bill.items[0]).toMatchObject({ name: 'soap', quantity: 3, unit: 'PCS', unitPrice: 25, taxRate: 0 });
    expect(bill.items[0].productId).toBeUndefined();
  });

  it('maps Tanglish names to English variants', () => {
    expect(nameVariants('arisi')).toContain('rice');
    expect(nameVariants('சர்க்கரை')).toContain('sugar');
  });
});

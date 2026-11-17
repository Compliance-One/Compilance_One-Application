import { allHsn, searchHsn } from '../lib/hsn';

describe('offline HSN search', () => {
  it('bundles a few hundred entries', () => {
    expect(allHsn().length).toBeGreaterThan(300);
  });
  it('finds by code prefix', () => {
    expect(searchHsn('1006')[0].code).toBe('1006');
  });
  it('finds by English, Tanglish and Tamil words', () => {
    expect(searchHsn('rice').map((e) => e.code)).toContain('1006');
    expect(searchHsn('arisi')[0].code).toBe('1006');
    expect(searchHsn('சர்க்கரை')[0].code).toBe('1701');
    expect(searchHsn('cement')[0].rate).toBe(18);
  });
});

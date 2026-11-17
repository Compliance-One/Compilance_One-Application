import { numberToInput, parseDecimal, sanitizeDecimalInput } from '../lib/numberInput';

describe('decimal inputs', () => {
  it('lets the user type a trailing dot and small decimals', () => {
    expect(sanitizeDecimalInput('2.')).toBe('2.');
    expect(sanitizeDecimalInput('0.5')).toBe('0.5');
    expect(sanitizeDecimalInput('.5')).toBe('0.5');
    expect(parseDecimal('2.')).toBe(2);
    expect(parseDecimal('0.5')).toBe(0.5);
  });

  it('drops junk, extra dots and extra decimals', () => {
    expect(sanitizeDecimalInput('12.5.6')).toBe('12.56');
    expect(sanitizeDecimalInput('₹1,250.505', 2)).toBe('1250.50');
    expect(sanitizeDecimalInput('12,5')).toBe('12.5');
    expect(sanitizeDecimalInput('007')).toBe('7');
  });

  it('parses empty or bad text as 0 and formats numbers back', () => {
    expect(parseDecimal('')).toBe(0);
    expect(parseDecimal('.')).toBe(0);
    expect(numberToInput(12.5)).toBe('12.5');
    expect(numberToInput(0.1 + 0.2)).toBe('0.3');
  });
});

import { amountInWords } from '../lib/amountInWords';

describe('amountInWords', () => {
  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Rupees Zero only');
  });

  it('handles whole rupees', () => {
    expect(amountInWords(1)).toBe('Rupees One only');
    expect(amountInWords(21)).toBe('Rupees Twenty-One only');
    expect(amountInWords(100)).toBe('Rupees One Hundred only');
  });

  it('uses the Indian numbering system', () => {
    expect(amountInWords(1000)).toBe('Rupees One Thousand only');
    expect(amountInWords(100000)).toBe('Rupees One Lakh only');
    expect(amountInWords(1234567)).toBe(
      'Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven only'
    );
  });

  it('includes paise', () => {
    expect(amountInWords(1234567.5)).toBe(
      'Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise only'
    );
    expect(amountInWords(0.05)).toBe('Rupees Zero and Five Paise only');
  });

  it('handles negative amounts', () => {
    expect(amountInWords(-10.25)).toBe('Minus Rupees Ten and Twenty-Five Paise only');
  });
});

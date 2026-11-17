/** Convert a rupee amount into Indian-English words, including paise. */
const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]}-${ONES[one]}` : TENS[ten];
}

function threeDigit(n: number): string {
  if (n < 100) return twoDigit(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return rest ? `${ONES[hundred]} Hundred ${twoDigit(rest)}` : `${ONES[hundred]} Hundred`;
}

function chunkWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${chunkWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
  if (rest) parts.push(threeDigit(rest));
  return parts.join(' ');
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rupees Zero only';
  const sign = amount < 0 ? 'Minus ' : '';
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs + 1e-9);
  const paise = Math.round((abs - rupees) * 100);
  const rupeeWords = chunkWords(rupees);
  if (paise > 0) {
    return `${sign}Rupees ${rupeeWords} and ${twoDigit(paise)} Paise only`;
  }
  return `${sign}Rupees ${rupeeWords} only`;
}

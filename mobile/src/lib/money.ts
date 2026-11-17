/** Convert a rupee amount to integer paise using ROUND_HALF_UP. */
export function rupeesToPaise(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const [intPart, frac = ''] = Math.abs(n).toString().split('.');
  const digits = (frac + '000').slice(0, 3);
  let paise = Number(intPart) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) paise += 1;
  return sign * paise;
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** (paise * ratePercent) / 100, rounded half-up to paise. */
export function percentOfPaise(paise: number, ratePercent: number): number {
  const rateMilli = rupeesToPaise(ratePercent); // 18 -> 1800, 2.5 -> 250
  const raw = paise * rateMilli;
  const sign = raw < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(raw) / 10000 + 0.5);
}

/** Round a paise total to the nearest rupee (0 paise), half-up. */
export function roundPaiseToRupee(paise: number): number {
  const sign = paise < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(paise) / 100 + 0.5) * 100;
}

/**
 * On-device GST engine, matching backend/app/services/gst_calculator.py:
 * intra-state = CGST + SGST (half rate each), inter-state = IGST,
 * amounts rounded to paise with ROUND_HALF_UP, invoice total rounded to the nearest rupee.
 */
import { paiseToRupees, percentOfPaise, roundPaiseToRupee, rupeesToPaise } from './money';

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

export const INDIAN_STATES = Object.entries(GST_STATE_CODES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code));

export function normalizeStateCode(code: string | null | undefined): string {
  const clean = String(code ?? '').trim();
  if (!clean) return '';
  return clean.padStart(2, '0').slice(0, 2);
}

export function stateNameFor(code: string): string {
  return GST_STATE_CODES[normalizeStateCode(code)] ?? 'Unknown State';
}

export function stateCodeFromGstin(gstin: string | null | undefined): string {
  const clean = (gstin ?? '').trim().toUpperCase();
  if (clean.length < 2) return '';
  return normalizeStateCode(clean.slice(0, 2));
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_PATTERN.test(gstin.trim().toUpperCase());
}

export interface GstLineInput {
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discountPercent?: number;
}

export interface GstLineResult {
  itemPrice: number;
  quantity: number;
  discountPercent: number;
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  sellerStateCode: string;
  buyerStateCode: string;
  isInterState: boolean;
  taxRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
}

export interface InvoiceTaxSummary {
  totalTaxableAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalIgstAmount: number;
  totalTaxAmount: number;
  subtotal: number;
  roundOff: number;
  grandTotal: number;
  isInterState: boolean;
  itemsCount: number;
}

export function calculateGst(
  item: GstLineInput,
  sellerStateCode: string,
  buyerStateCode: string
): GstLineResult {
  const seller = normalizeStateCode(sellerStateCode);
  const buyer = normalizeStateCode(buyerStateCode);
  // Empty buyer defaults to seller (intra-state), matching a typical walk-in invoice.
  const effectiveBuyer = buyer || seller;
  const inter = seller !== effectiveBuyer;

  const grossPaise = rupeesToPaise(item.unitPrice) * Math.max(0, item.quantity);
  const discountPaise = percentOfPaise(grossPaise, item.discountPercent ?? 0);
  let taxablePaise = grossPaise - discountPaise;
  if (taxablePaise < 0) taxablePaise = 0;

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (inter) {
    igstRate = item.taxRate;
    igstPaise = percentOfPaise(taxablePaise, igstRate);
  } else {
    cgstRate = item.taxRate / 2;
    sgstRate = item.taxRate / 2;
    cgstPaise = percentOfPaise(taxablePaise, cgstRate);
    sgstPaise = percentOfPaise(taxablePaise, sgstRate);
  }

  const taxPaise = cgstPaise + sgstPaise + igstPaise;

  return {
    itemPrice: item.unitPrice,
    quantity: item.quantity,
    discountPercent: item.discountPercent ?? 0,
    grossAmount: paiseToRupees(grossPaise),
    discountAmount: paiseToRupees(discountPaise),
    taxableAmount: paiseToRupees(taxablePaise),
    sellerStateCode: seller,
    buyerStateCode: effectiveBuyer,
    isInterState: inter,
    taxRate: item.taxRate,
    cgstRate,
    cgstAmount: paiseToRupees(cgstPaise),
    sgstRate,
    sgstAmount: paiseToRupees(sgstPaise),
    igstRate,
    igstAmount: paiseToRupees(igstPaise),
    totalTaxAmount: paiseToRupees(taxPaise),
    totalAmount: paiseToRupees(taxablePaise + taxPaise),
  };
}

export function calculateInvoiceTotals(
  items: GstLineInput[],
  sellerStateCode: string,
  buyerStateCode: string
): { lines: GstLineResult[]; summary: InvoiceTaxSummary } {
  const lines = items.map((it) => calculateGst(it, sellerStateCode, buyerStateCode));
  const taxablePaise = lines.reduce((s, l) => s + rupeesToPaise(l.taxableAmount), 0);
  const cgstPaise = lines.reduce((s, l) => s + rupeesToPaise(l.cgstAmount), 0);
  const sgstPaise = lines.reduce((s, l) => s + rupeesToPaise(l.sgstAmount), 0);
  const igstPaise = lines.reduce((s, l) => s + rupeesToPaise(l.igstAmount), 0);
  const taxPaise = cgstPaise + sgstPaise + igstPaise;
  const subtotalPaise = taxablePaise + taxPaise;
  const grandPaise = roundPaiseToRupee(subtotalPaise);
  const seller = normalizeStateCode(sellerStateCode);
  const buyer = normalizeStateCode(buyerStateCode) || seller;

  return {
    lines,
    summary: {
      totalTaxableAmount: paiseToRupees(taxablePaise),
      totalCgstAmount: paiseToRupees(cgstPaise),
      totalSgstAmount: paiseToRupees(sgstPaise),
      totalIgstAmount: paiseToRupees(igstPaise),
      totalTaxAmount: paiseToRupees(taxPaise),
      subtotal: paiseToRupees(subtotalPaise),
      roundOff: paiseToRupees(grandPaise - subtotalPaise),
      grandTotal: paiseToRupees(grandPaise),
      isInterState: seller !== buyer,
      itemsCount: lines.length,
    },
  };
}

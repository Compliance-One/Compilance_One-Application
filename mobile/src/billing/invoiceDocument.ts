/** Shared invoice snapshot used by PDF, ESC/POS, and detail queries. */
export interface InvoiceParty {
  id?: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
}

export interface InvoiceDocumentItem {
  id: string;
  name: string;
  hsnCode?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface InvoiceDocument {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  invoiceType: 'B2B' | 'B2C';
  placeOfSupplyCode: string;
  placeOfSupplyName: string;
  reverseCharge: boolean;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  paymentStatus: string;
  seller: InvoiceParty;
  buyer: InvoiceParty | null;
  items: InvoiceDocumentItem[];
}

import { amountInWords } from '../lib/amountInWords';
import { formatINR } from '../lib/format';
import { stateNameFor } from '../lib/gst';
import type { InvoiceDocument } from '../billing/invoiceDocument';
import i18n from '../i18n';

export type PaperWidthMm = 58 | 80;

export type ReceiptAlign = 'left' | 'center' | 'right';

export interface ReceiptTextNode {
  type: 'text';
  value: string;
  align?: ReceiptAlign;
  bold?: boolean;
  size?: 1 | 2;
}

export interface ReceiptLineNode {
  type: 'line';
  style?: 'solid' | 'dashed';
}

export interface ReceiptFeedNode {
  type: 'feed';
  lines?: number;
}

export interface ReceiptCutNode {
  type: 'cut';
}

export type ReceiptNode = ReceiptTextNode | ReceiptLineNode | ReceiptFeedNode | ReceiptCutNode;

export interface ReceiptDocument {
  paperWidthMm: PaperWidthMm;
  cols: number;
  nodes: ReceiptNode[];
  /** Raw ESC/POS byte stream for the same receipt. */
  bytes: Uint8Array;
}

export function columnsFor(paperWidthMm: PaperWidthMm): number {
  return paperWidthMm === 80 ? 48 : 32;
}

function pad(left: string, right: string, cols: number): string {
  const space = cols - left.length - right.length;
  if (space < 1) {
    const trimmed = left.slice(0, Math.max(0, cols - right.length - 1));
    return pad(trimmed, right, cols);
  }
  return `${left}${' '.repeat(space)}${right}`;
}

function money(n: number): string {
  return formatINR(n).replace('₹', '');
}

function dateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

class EscPosWriter {
  private chunks: number[] = [];

  init(): this {
    this.chunks.push(ESC, 0x40);
    return this;
  }

  align(a: ReceiptAlign): this {
    const n = a === 'center' ? 1 : a === 'right' ? 2 : 0;
    this.chunks.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  size(n: 1 | 2): this {
    // GS ! n — bit 0-3 height, 4-7 width
    this.chunks.push(GS, 0x21, n === 2 ? 0x11 : 0x00);
    return this;
  }

  text(s: string): this {
    for (let i = 0; i < s.length; i++) this.chunks.push(s.charCodeAt(i) & 0xff);
    return this;
  }

  lineFeed(n = 1): this {
    for (let i = 0; i < n; i++) this.chunks.push(LF);
    return this;
  }

  cut(): this {
    this.chunks.push(GS, 0x56, 0x00);
    return this;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

export function buildReceipt(invoice: InvoiceDocument, paperWidthMm: PaperWidthMm = 58): ReceiptDocument {
  const cols = columnsFor(paperWidthMm);
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;
  const nodes: ReceiptNode[] = [];
  const dash = '-'.repeat(cols);
  const eq = '='.repeat(cols);
  const sellerState = invoice.seller.stateName || stateNameFor(invoice.seller.stateCode ?? '');

  const push = (value: string, opts?: Omit<ReceiptTextNode, 'type' | 'value'>) => {
    nodes.push({ type: 'text', value, ...opts });
  };

  push(t('receipt.taxInvoice'), { align: 'center', bold: true, size: 2 });
  push(invoice.seller.name, { align: 'center', bold: true });
  if (invoice.seller.address) push(invoice.seller.address, { align: 'center' });
  if (invoice.seller.phone) push(`${t('receipt.phone')}: ${invoice.seller.phone}`, { align: 'center' });
  if (invoice.seller.gstin) push(`${t('receipt.gstin')}: ${invoice.seller.gstin}`, { align: 'center', bold: true });
  if (sellerState) {
    push(`${sellerState} (${invoice.seller.stateCode ?? ''})`, { align: 'center' });
  }
  nodes.push({ type: 'line', style: 'solid' });
  push(`${t('receipt.inv')}: ${invoice.invoiceNumber}`);
  push(`${t('receipt.date')}: ${dateLabel(invoice.invoiceDate)}`);
  if (invoice.dueDate) push(`${t('receipt.due')}: ${dateLabel(invoice.dueDate)}`);
  push(`${t('receipt.type')}: ${invoice.invoiceType}`);
  push(`${t('receipt.pos')}: ${invoice.placeOfSupplyName} (${invoice.placeOfSupplyCode})`);
  if (invoice.buyer) {
    nodes.push({ type: 'line', style: 'dashed' });
    push(`${t('receipt.billTo')}: ${invoice.buyer.name}`, { bold: true });
    if (invoice.buyer.gstin) push(`${t('receipt.gstin')}: ${invoice.buyer.gstin}`);
    if (invoice.buyer.address) push(invoice.buyer.address);
  }
  nodes.push({ type: 'line', style: 'solid' });
  push(pad(t('receipt.item'), t('receipt.amount'), cols), { bold: true });

  for (const item of invoice.items) {
    const title = `${item.quantity} ${item.unit} ${item.name}`;
    push(title);
    if (item.hsnCode) push(`  HSN ${item.hsnCode}  @${item.gstRate}%`);
    const qtyRate = `  ${item.quantity} x ${money(item.unitPrice)}`;
    push(pad(qtyRate, money(item.lineTotal), cols));
    if (item.igstAmount > 0) {
      push(pad('  IGST', money(item.igstAmount), cols));
    } else if (item.cgstAmount + item.sgstAmount > 0) {
      push(pad('  CGST', money(item.cgstAmount), cols));
      push(pad('  SGST', money(item.sgstAmount), cols));
    }
  }

  nodes.push({ type: 'line', style: 'solid' });
  push(pad(t('pdf.taxable'), money(invoice.taxableAmount), cols));
  if (invoice.cgstAmount > 0) push(pad('CGST', money(invoice.cgstAmount), cols));
  if (invoice.sgstAmount > 0) push(pad('SGST', money(invoice.sgstAmount), cols));
  if (invoice.igstAmount > 0) push(pad('IGST', money(invoice.igstAmount), cols));
  if (invoice.discount > 0) push(pad(t('receipt.discount'), money(invoice.discount), cols));
  nodes.push({ type: 'line', style: 'solid' });
  push(pad(t('receipt.total'), money(invoice.totalAmount), cols), { bold: true, size: 2 });
  push(amountInWords(invoice.totalAmount));
  push(`${t('receipt.reverseCharge')}: ${invoice.reverseCharge ? t('receipt.yes') : t('receipt.no')}`);
  nodes.push({ type: 'feed', lines: 1 });
  push(t('receipt.thankYou'), { align: 'center' });
  nodes.push({ type: 'feed', lines: 2 });
  nodes.push({ type: 'cut' });

  const bytesWriter = new EscPosWriter().init();
  for (const node of nodes) {
    if (node.type === 'text') {
      bytesWriter.align(node.align ?? 'left');
      bytesWriter.bold(!!node.bold);
      bytesWriter.size(node.size ?? 1);
      bytesWriter.text(node.value);
      bytesWriter.lineFeed(1);
      bytesWriter.bold(false);
      bytesWriter.size(1);
    } else if (node.type === 'line') {
      bytesWriter.align('left');
      bytesWriter.text(node.style === 'dashed' ? dash : eq);
      bytesWriter.lineFeed(1);
    } else if (node.type === 'feed') {
      bytesWriter.lineFeed(node.lines ?? 1);
    } else if (node.type === 'cut') {
      bytesWriter.cut();
    }
  }

  return { paperWidthMm, cols, nodes, bytes: bytesWriter.toBytes() };
}

export function receiptToText(receipt: ReceiptDocument): string {
  return receipt.nodes
    .map((n) => {
      if (n.type === 'text') return n.value;
      if (n.type === 'line') return n.style === 'dashed' ? '-'.repeat(receipt.cols) : '='.repeat(receipt.cols);
      if (n.type === 'feed') return '\n'.repeat(n.lines ?? 1).trimEnd();
      if (n.type === 'cut') return '[CUT]';
      return '';
    })
    .filter((l) => l !== '')
    .join('\n');
}

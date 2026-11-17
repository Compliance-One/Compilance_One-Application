/**
 * Builds a GSTR-1 JSON payload offline from local SQLite.
 *
 * Shape follows the GSTN offline-utility / GSTR-1 JSON conventions documented
 * at https://tutorial.gst.gov.in/userguide/returns/GSTR_1.htm and
 * https://tutorial.gst.gov.in/downloads/invoiceuploadofflineutility.pdf
 * (gstin, fp as MMYYYY, b2b, b2cl, b2cs, hsn.hsn_b2b / hsn.hsn_b2c from
 * May 2025, doc_issue). Dates are DD-MM-YYYY. Place-of-supply codes are
 * two-digit GST state codes. Amounts are rounded to 2 decimals.
 *
 * The official Windows offline tool was not executed; treat exports as drafts
 * until confirmed on the GST portal.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeStateCode } from '../lib/gst';

const B2CL_THRESHOLD = 100000;
const NOT_CANCELLED = `AND UPPER(i.payment_status) != 'CANCELLED'`;

export interface InvoiceJoinRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'B2B' | 'B2C' | string;
  total_amount: number;
  payment_status?: string | null;
  customer_gstin: string | null;
  customer_state: string | null;
  seller_state: string | null;
}

export interface ItemRow {
  invoice_id: string;
  hsn_code: string | null;
  unit: string | null;
  quantity: number;
  gst_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

export interface DocInvoiceRow {
  invoice_number: string;
  payment_status: string | null;
}

export interface Gstr1Stats {
  total_invoices: number;
  total_b2b: number;
  total_b2c: number;
  taxable_value: number;
  total_tax: number;
}

export interface Gstr1File {
  /** Official-schema document, ready to write to a .json file. */
  payload: Record<string, unknown>;
  stats: Gstr1Stats;
  fp: string;
}

export function toDdMmYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function fpOf(fromDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(fromDate);
  if (!m) return fromDate.replaceAll('-', '').slice(0, 6);
  return `${m[2]}${m[1]}`;
}

export function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const UQC_MAP: Record<string, string> = {
  KG: 'KGS',
  KGS: 'KGS',
  KILO: 'KGS',
  KILOGRAM: 'KGS',
  PCS: 'NOS',
  PC: 'NOS',
  PIECE: 'NOS',
  PIECES: 'NOS',
  NOS: 'NOS',
  NO: 'NOS',
  UNIT: 'NOS',
  BOX: 'BOX',
  BX: 'BOX',
  LTR: 'LTR',
  LITRE: 'LTR',
  LITER: 'LTR',
  L: 'LTR',
  MTR: 'MTR',
  METER: 'MTR',
  METRE: 'MTR',
  M: 'MTR',
  OTH: 'OTH',
};

export function mapUqc(unit: string | null | undefined): string {
  const raw = (unit || 'OTH').trim().toUpperCase();
  if (UQC_MAP[raw]) return UQC_MAP[raw];
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  return 'OTH';
}

function seriesOf(num: string): { prefix: string; n: number } {
  const trimmed = num.trim();
  const m = /^(.*?)(\d+)$/.exec(trimmed);
  if (!m) return { prefix: trimmed, n: 0 };
  return { prefix: m[1], n: Number(m[2]) };
}

export function buildDocIssue(docs: DocInvoiceRow[]): Record<string, unknown> {
  const groups = new Map<string, DocInvoiceRow[]>();
  for (const row of docs) {
    const key = seriesOf(row.invoice_number).prefix || '(none)';
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const series = [...groups.values()].map((rows, idx) => {
    const sorted = [...rows].sort((a, b) => seriesOf(a.invoice_number).n - seriesOf(b.invoice_number).n);
    const cancelled = sorted.filter((r) => String(r.payment_status || '').toUpperCase() === 'CANCELLED').length;
    return {
      num: idx + 1,
      from: sorted[0].invoice_number,
      to: sorted[sorted.length - 1].invoice_number,
      totnum: sorted.length,
      cancel: cancelled,
      net_issue: sorted.length - cancelled,
    };
  });
  return {
    doc_det: [
      {
        doc_num: 1, // Invoices for outward supply (Table 13)
        docs: series.length ? series : [],
      },
    ],
  };
}

export function buildGstr1Payload(
  invoices: InvoiceJoinRow[],
  items: ItemRow[],
  allDocs: DocInvoiceRow[],
  gstin: string,
  fromDate: string
): Gstr1File {
  const itemsByInvoice = new Map<string, ItemRow[]>();
  for (const it of items) {
    const list = itemsByInvoice.get(it.invoice_id) ?? [];
    list.push(it);
    itemsByInvoice.set(it.invoice_id, list);
  }

  const sellerFallback =
    normalizeStateCode(invoices[0]?.seller_state) || (gstin ? gstin.slice(0, 2) : '');

  type InvObj = Record<string, unknown>;
  const b2bByCtin = new Map<string, InvObj[]>();
  const b2clByPos = new Map<string, InvObj[]>();
  const b2csAgg = new Map<
    string,
    {
      sply_ty: string;
      rt: number;
      typ: string;
      pos: string;
      txval: number;
      camt: number;
      samt: number;
      iamt: number;
      csamt: number;
    }
  >();

  const b2bInvoiceIds = new Set<string>();
  let taxableTotal = 0;
  let taxTotal = 0;
  let b2bCount = 0;
  let b2cCount = 0;

  const rateGroups = (invItems: ItemRow[]) => {
    const groups = new Map<number, { txval: number; camt: number; samt: number; iamt: number }>();
    for (const it of invItems) {
      const g = groups.get(it.gst_rate) ?? { txval: 0, camt: 0, samt: 0, iamt: 0 };
      g.txval += it.taxable_value;
      g.camt += it.cgst_amount;
      g.samt += it.sgst_amount;
      g.iamt += it.igst_amount;
      groups.set(it.gst_rate, g);
    }
    return [...groups.entries()].map(([rt, g], idx) => ({
      num: idx + 1,
      itm_det: {
        txval: money(g.txval),
        rt,
        camt: money(g.camt),
        samt: money(g.samt),
        iamt: money(g.iamt),
        csamt: 0,
      },
    }));
  };

  for (const inv of invoices) {
    const invItems = itemsByInvoice.get(inv.id) ?? [];
    const txval = invItems.reduce((s, it) => s + it.taxable_value, 0);
    const tax = invItems.reduce((s, it) => s + it.cgst_amount + it.sgst_amount + it.igst_amount, 0);
    taxableTotal += txval;
    taxTotal += tax;

    const seller = normalizeStateCode(inv.seller_state) || sellerFallback;
    const buyer =
      normalizeStateCode(inv.customer_state) ||
      (inv.customer_gstin ? normalizeStateCode(inv.customer_gstin.slice(0, 2)) : seller);
    const pos = buyer || seller;
    const isInter = seller !== buyer && !!seller && !!buyer;

    if (inv.invoice_type === 'B2B' || (inv.customer_gstin && inv.customer_gstin.trim())) {
      b2bCount += 1;
      b2bInvoiceIds.add(inv.id);
      const ctin = (inv.customer_gstin ?? '').trim().toUpperCase();
      const entry = {
        inum: inv.invoice_number,
        idt: toDdMmYyyy(inv.invoice_date),
        val: money(inv.total_amount),
        pos,
        rchrg: 'N',
        inv_typ: 'R',
        itms: rateGroups(invItems),
      };
      const list = b2bByCtin.get(ctin) ?? [];
      list.push(entry);
      b2bByCtin.set(ctin, list);
    } else {
      b2cCount += 1;
      if (isInter && inv.total_amount > B2CL_THRESHOLD) {
        const entry = {
          inum: inv.invoice_number,
          idt: toDdMmYyyy(inv.invoice_date),
          val: money(inv.total_amount),
          itms: rateGroups(invItems),
        };
        const list = b2clByPos.get(pos) ?? [];
        list.push(entry);
        b2clByPos.set(pos, list);
      } else {
        for (const it of invItems) {
          const key = `${isInter ? 'INTER' : 'INTRA'}|${it.gst_rate}|${pos}`;
          const cur = b2csAgg.get(key) ?? {
            sply_ty: isInter ? 'INTER' : 'INTRA',
            rt: it.gst_rate,
            typ: 'OE',
            pos,
            txval: 0,
            camt: 0,
            samt: 0,
            iamt: 0,
            csamt: 0,
          };
          cur.txval += it.taxable_value;
          cur.camt += it.cgst_amount;
          cur.samt += it.sgst_amount;
          cur.iamt += it.igst_amount;
          b2csAgg.set(key, cur);
        }
      }
    }
  }

  type HsnRow = {
    hsn_sc: string;
    uqc: string;
    qty: number;
    rt: number;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
  };
  const hsnB2b = new Map<string, HsnRow>();
  const hsnB2c = new Map<string, HsnRow>();
  const bumpHsn = (map: Map<string, HsnRow>, it: ItemRow) => {
    const hsn = (it.hsn_code || '').trim() || '0';
    const uqc = mapUqc(it.unit);
    const key = `${hsn}|${it.gst_rate}|${uqc}`;
    const cur = map.get(key) ?? {
      hsn_sc: hsn,
      uqc,
      qty: 0,
      rt: it.gst_rate,
      txval: 0,
      iamt: 0,
      camt: 0,
      samt: 0,
      csamt: 0,
    };
    cur.qty += it.quantity;
    cur.txval += it.taxable_value;
    cur.iamt += it.igst_amount;
    cur.camt += it.cgst_amount;
    cur.samt += it.sgst_amount;
    map.set(key, cur);
  };
  for (const it of items) {
    bumpHsn(b2bInvoiceIds.has(it.invoice_id) ? hsnB2b : hsnB2c, it);
  }

  const toHsnRows = (map: Map<string, HsnRow>) =>
    [...map.values()].map((r, idx) => ({
      num: idx + 1,
      hsn_sc: r.hsn_sc,
      desc: '',
      uqc: r.uqc,
      qty: money(r.qty),
      rt: r.rt,
      txval: money(r.txval),
      iamt: money(r.iamt),
      camt: money(r.camt),
      samt: money(r.samt),
      csamt: 0,
    }));

  const payload: Record<string, unknown> = {
    gstin: gstin.toUpperCase(),
    fp: fpOf(fromDate),
    gt: 0,
    cur_gt: 0,
    hsn: {
      hsn_b2b: toHsnRows(hsnB2b),
      hsn_b2c: toHsnRows(hsnB2c),
    },
    doc_issue: buildDocIssue(allDocs),
  };
  if (b2bByCtin.size) {
    payload.b2b = [...b2bByCtin.entries()].map(([ctin, inv]) => ({ ctin, inv }));
  }
  if (b2clByPos.size) {
    payload.b2cl = [...b2clByPos.entries()].map(([pos, inv]) => ({ pos, inv }));
  }
  if (b2csAgg.size) {
    payload.b2cs = [...b2csAgg.values()].map((r) => ({
      ...r,
      txval: money(r.txval),
      camt: money(r.camt),
      samt: money(r.samt),
      iamt: money(r.iamt),
      csamt: 0,
    }));
  }

  return {
    payload,
    stats: {
      total_invoices: invoices.length,
      total_b2b: b2bCount,
      total_b2c: b2cCount,
      taxable_value: money(taxableTotal),
      total_tax: money(taxTotal),
    },
    fp: String(payload.fp),
  };
}

export async function generateGstr1Json(
  db: SQLiteDatabase,
  businessId: string,
  gstin: string,
  fromDate: string,
  toDate: string
): Promise<Gstr1File> {
  const invoices = await db.getAllAsync<InvoiceJoinRow>(
    `SELECT i.id, i.invoice_number, i.invoice_date, i.invoice_type, i.total_amount,
            i.payment_status,
            c.gstin AS customer_gstin, c.state_code AS customer_state,
            b.state_code AS seller_state
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     LEFT JOIN businesses b ON b.id = i.business_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ? ${NOT_CANCELLED}
     ORDER BY i.invoice_date, i.invoice_number`,
    [businessId, fromDate, toDate]
  );

  const items = await db.getAllAsync<ItemRow>(
    `SELECT ii.invoice_id, ii.hsn_code, p.unit, ii.quantity, ii.gst_rate,
            ii.taxable_value, ii.cgst_amount, ii.sgst_amount, ii.igst_amount
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     LEFT JOIN products p ON p.id = ii.product_id
     WHERE i.business_id = ? AND i.invoice_date BETWEEN ? AND ? ${NOT_CANCELLED}`,
    [businessId, fromDate, toDate]
  );

  const allDocs = await db.getAllAsync<DocInvoiceRow>(
    `SELECT invoice_number, payment_status FROM invoices
     WHERE business_id = ? AND invoice_date BETWEEN ? AND ?
     ORDER BY invoice_number`,
    [businessId, fromDate, toDate]
  );

  return buildGstr1Payload(invoices, items, allDocs, gstin, fromDate);
}

/**
 * Builds a GSTR-1 JSON payload offline from local SQLite.
 *
 * The shape follows the commonly published GSTN / GST portal offline-utility
 * schema (gstin, fp, gt, cur_gt, b2b, b2cl, b2cs, hsn.data) as best as can
 * be verified from public documentation. It has NOT been validated against a
 * live GST portal sample or the official offline tool. Treat exports as drafts.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeStateCode } from '../lib/gst';

const B2CL_THRESHOLD = 100000;
const NOT_CANCELLED = `AND UPPER(i.payment_status) != 'CANCELLED'`;

interface InvoiceJoinRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'B2B' | 'B2C';
  total_amount: number;
  customer_gstin: string | null;
  customer_state: string | null;
  seller_state: string | null;
}

interface ItemRow {
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

function toDdMmYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function fpOf(fromDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(fromDate);
  if (!m) return fromDate.replaceAll('-', '').slice(0, 6);
  return `${m[2]}${m[1]}`;
}

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
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

  const itemsByInvoice = new Map<string, ItemRow[]>();
  for (const it of items) {
    const list = itemsByInvoice.get(it.invoice_id) ?? [];
    list.push(it);
    itemsByInvoice.set(it.invoice_id, list);
  }

  const sellerFallback = normalizeStateCode(invoices[0]?.seller_state) || (gstin ? gstin.slice(0, 2) : '');

  type InvObj = Record<string, unknown>;
  const b2bByCtin = new Map<string, InvObj[]>();
  const b2clByPos = new Map<string, InvObj[]>();
  const b2csAgg = new Map<string, {
    sply_ty: string;
    rt: number;
    typ: string;
    pos: string;
    txval: number;
    camt: number;
    samt: number;
    iamt: number;
    csamt: number;
  }>();

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
    const buyer = normalizeStateCode(inv.customer_state) ||
      (inv.customer_gstin ? normalizeStateCode(inv.customer_gstin.slice(0, 2)) : seller);
    const pos = buyer || seller;
    const isInter = seller !== buyer && !!seller && !!buyer;

    if (inv.invoice_type === 'B2B' || (inv.customer_gstin && inv.customer_gstin.trim())) {
      b2bCount += 1;
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

  const hsnMap = new Map<string, {
    hsn_sc: string;
    uqc: string;
    qty: number;
    rt: number;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
  }>();
  for (const it of items) {
    const hsn = (it.hsn_code || '').trim() || '0';
    const key = `${hsn}|${it.gst_rate}|${(it.unit || 'OTH').toUpperCase()}`;
    const cur = hsnMap.get(key) ?? {
      hsn_sc: hsn,
      uqc: (it.unit || 'OTH').toUpperCase(),
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
    hsnMap.set(key, cur);
  }

  const payload = {
    gstin: gstin.toUpperCase(),
    fp: fpOf(fromDate),
    gt: 0,
    cur_gt: 0,
    b2b: [...b2bByCtin.entries()].map(([ctin, inv]) => ({ ctin, inv })),
    b2cl: [...b2clByPos.entries()].map(([pos, inv]) => ({ pos, inv })),
    b2cs: [...b2csAgg.values()].map((r) => ({
      ...r,
      txval: money(r.txval),
      camt: money(r.camt),
      samt: money(r.samt),
      iamt: money(r.iamt),
      csamt: 0,
    })),
    hsn: {
      data: [...hsnMap.values()].map((r, idx) => ({
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
      })),
    },
  };

  return {
    payload,
    stats: {
      total_invoices: invoices.length,
      total_b2b: b2bCount,
      total_b2c: b2cCount,
      taxable_value: money(taxableTotal),
      total_tax: money(taxTotal),
    },
    fp: payload.fp,
  };
}

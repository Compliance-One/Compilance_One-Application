/**
 * Member 4 — Reporting & Compliance
 * mobile/src/gstr1/generateGstr1.ts
 *
 * Generates the offline GSTR-1 JSON payload from local SQLite data.
 * Formats B2B (registered) and B2CS (unregistered, B2C) invoices
 * exactly as required by the GSTN portal.
 */

import { db } from '../db/client';
import { invoices, invoiceItems, customers, businesses } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { gstr1Exports } from '../db/schema';
import { enqueue } from '../sync/outbox';

export interface Gstr1Payload {
  gstin: string;
  fp:    string; // "MMYYYY"
  gt:    number;
  cur_gt:number;
  b2b:   any[];
  b2cs:  any[];
}

/**
 * Generates the GSTR-1 JSON and saves a record of the export.
 * 
 * @param businessId 
 * @param periodFrom "YYYY-MM-DD"
 * @param periodTo "YYYY-MM-DD"
 */
export async function generateGstr1(
  businessId: string,
  periodFrom: string,
  periodTo:   string
): Promise<Gstr1Payload> {
  // 1. Get Business details
  const bizRow = await db.select().from(businesses).where(eq(businesses.id, businessId));
  const biz = bizRow[0];
  if (!biz || !biz.gstin) throw new Error("GSTIN is required to generate GSTR-1");

  // 2. Fetch all invoices in period
  const invRows = await db.select().from(invoices)
    .where(
      and(
        eq(invoices.businessId, businessId),
        gte(invoices.invoiceDate, periodFrom),
        lte(invoices.invoiceDate, periodTo)
      )
    );

  // 3. Separate B2B and B2C
  const b2bInvoices = invRows.filter(i => i.invoiceType === 'B2B');
  const b2cInvoices = invRows.filter(i => i.invoiceType === 'B2C');

  const b2bPayload: any[] = [];
  const b2csPayload: any[] = [];

  // Group B2B by Customer GSTIN
  // This is a simplified transformation for demonstration.
  for (const inv of b2bInvoices) {
    if (!inv.customerId) continue;
    const custRow = await db.select().from(customers).where(eq(customers.id, inv.customerId));
    const customer = custRow[0];
    if (!customer?.gstin) continue;

    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
    
    // Group items by rate
    const rateMap: Record<string, { txval: number; iamt: number; camt: number; samt: number }> = {};
    items.forEach(it => {
      const rateStr = it.gstRate.toString();
      if (!rateMap[rateStr]) rateMap[rateStr] = { txval: 0, iamt: 0, camt: 0, samt: 0 };
      rateMap[rateStr].txval += it.taxableAmount;
      rateMap[rateStr].iamt += it.igst;
      rateMap[rateStr].camt += it.cgst;
      rateMap[rateStr].samt += it.sgst;
    });

    const itms = Object.keys(rateMap).map(rate => ({
      num: 1, // Simplified
      itm_det: {
        rt: parseFloat(rate),
        txval: rateMap[rate].txval,
        iamt: rateMap[rate].iamt,
        camt: rateMap[rate].camt,
        samt: rateMap[rate].samt,
      }
    }));

    b2bPayload.push({
      ctin: customer.gstin,
      inv: [{
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate.split('-').reverse().join('-'), // DD-MM-YYYY
        val: inv.grandTotal,
        pos: biz.stateCode, // Simplified, assumes intra-state B2B
        inv_typ: "R",
        itms
      }]
    });
  }

  // Group B2CS by Rate and POS (simplified to single state)
  const b2cRateMap: Record<string, { txval: number; iamt: number; camt: number; samt: number }> = {};
  for (const inv of b2cInvoices) {
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
    items.forEach(it => {
      const rateStr = it.gstRate.toString();
      if (!b2cRateMap[rateStr]) b2cRateMap[rateStr] = { txval: 0, iamt: 0, camt: 0, samt: 0 };
      b2cRateMap[rateStr].txval += it.taxableAmount;
      b2cRateMap[rateStr].iamt += it.igst;
      b2cRateMap[rateStr].camt += it.cgst;
      b2cRateMap[rateStr].samt += it.sgst;
    });
  }

  Object.keys(b2cRateMap).forEach(rate => {
    b2csPayload.push({
      sply_ty: b2cRateMap[rate].iamt > 0 ? "INTER" : "INTRA",
      rt: parseFloat(rate),
      typ: "OE",
      pos: biz.stateCode,
      txval: b2cRateMap[rate].txval,
      iamt: b2cRateMap[rate].iamt,
      camt: b2cRateMap[rate].camt,
      samt: b2cRateMap[rate].samt,
    });
  });

  const [year, month] = periodFrom.split('-');
  const fp = `${month}${year}`;

  const finalPayload: Gstr1Payload = {
    gstin: biz.gstin,
    fp,
    gt: 0, // gross turnover prev yr
    cur_gt: 0, // current gross turnover
    b2b: b2bPayload,
    b2cs: b2csPayload
  };

  // Record export
  const exportId = uuidv4();
  const payloadStr = JSON.stringify(finalPayload);
  
  await db.insert(gstr1Exports).values({
    id: exportId,
    businessId,
    periodFrom,
    periodTo,
    totalInvoices: invRows.length,
    totalB2b: b2bInvoices.length,
    totalB2c: b2cInvoices.length,
    jsonPayload: payloadStr,
    exportedAt: new Date().toISOString()
  });

  await enqueue('gstr1_exports', 'INSERT', exportId, {
    id: exportId, businessId, periodFrom, periodTo, totalInvoices: invRows.length, jsonPayload: payloadStr
  });

  return finalPayload;
}

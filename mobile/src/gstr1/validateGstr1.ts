/**
 * Structural validator for a GSTR-1 JSON payload.
 *
 * GSTN does not publish a machine-readable JSON Schema for the offline-tool
 * file. This validator encodes the field names, types, and formats documented
 * in the official sources below, plus the post-May 2025 HSN split:
 *
 * - GST portal tutorial: Form GSTR-1
 *   https://tutorial.gst.gov.in/userguide/returns/GSTR_1.htm
 *   (HSN-wise summary is furnished separately as HSN (B2B) and HSN (B2C)
 *   from May 2025 onwards.)
 * - GST portal: Returns Offline Tool FAQ / user manual
 *   https://tutorial.gst.gov.in/downloads/invoiceuploadofflineutility.pdf
 *   (worksheet names b2b, b2cl, b2cs, hsn, docs / List of Documents issued)
 * - Filing-period format MMYYYY and invoice dates as DD-MM-YYYY are the
 *   published conventions of the offline utility and GSTR-1 JSON.
 *
 * The official desktop utility itself is Windows-only and was not executed
 * here. Exports that pass this validator are still drafts until a taxpayer
 * confirms them in the GST portal / official tool.
 */

export interface Gstr1Issue {
  path: string;
  message: string;
}

export interface Gstr1ValidationResult {
  ok: boolean;
  issues: Gstr1Issue[];
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const FP_RE = /^(0[1-9]|1[0-2])\d{4}$/;
const DATE_RE = /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
const POS_RE = /^\d{2}$/;

function issue(issues: Gstr1Issue[], path: string, message: string) {
  issues.push({ path, message });
}

function isMoney(n: unknown): boolean {
  if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

function checkItmDet(issues: Gstr1Issue[], path: string, det: unknown, requireCgst: boolean) {
  if (!det || typeof det !== 'object') {
    issue(issues, path, 'itm_det must be an object');
    return;
  }
  const d = det as Record<string, unknown>;
  for (const key of ['rt', 'txval']) {
    if (typeof d[key] !== 'number') issue(issues, `${path}.${key}`, `${key} must be a number`);
  }
  for (const key of ['txval', 'iamt', 'csamt', ...(requireCgst ? ['camt', 'samt'] : [])]) {
    if (d[key] !== undefined && !isMoney(d[key])) {
      issue(issues, `${path}.${key}`, `${key} must be rounded to 2 decimal places`);
    }
  }
}

function checkInvoice(issues: Gstr1Issue[], path: string, inv: unknown, opts: { pos?: boolean; typ: 'b2b' | 'b2cl' }) {
  if (!inv || typeof inv !== 'object') {
    issue(issues, path, 'invoice must be an object');
    return;
  }
  const row = inv as Record<string, unknown>;
  if (typeof row.inum !== 'string' || !row.inum.trim()) issue(issues, `${path}.inum`, 'invoice number is required');
  if (typeof row.idt !== 'string' || !DATE_RE.test(row.idt)) {
    issue(issues, `${path}.idt`, 'invoice date must be DD-MM-YYYY');
  }
  if (!isMoney(row.val)) issue(issues, `${path}.val`, 'invoice value must be a 2-decimal number');
  if (opts.typ === 'b2b') {
    if (typeof row.pos !== 'string' || !POS_RE.test(row.pos)) issue(issues, `${path}.pos`, 'pos must be a 2-digit state code');
    if (row.rchrg !== 'Y' && row.rchrg !== 'N') issue(issues, `${path}.rchrg`, 'rchrg must be Y or N');
    if (typeof row.inv_typ !== 'string') issue(issues, `${path}.inv_typ`, 'inv_typ is required');
  }
  if (!Array.isArray(row.itms) || row.itms.length === 0) {
    issue(issues, `${path}.itms`, 'at least one item is required');
    return;
  }
  row.itms.forEach((it, i) => {
    const item = it as Record<string, unknown>;
    if (typeof item.num !== 'number') issue(issues, `${path}.itms[${i}].num`, 'num must be a number');
    checkItmDet(issues, `${path}.itms[${i}].itm_det`, item.itm_det, opts.typ === 'b2b');
  });
}

function checkHsnRows(issues: Gstr1Issue[], path: string, rows: unknown) {
  if (!Array.isArray(rows)) {
    issue(issues, path, 'must be an array');
    return;
  }
  rows.forEach((row, i) => {
    const r = row as Record<string, unknown>;
    const p = `${path}[${i}]`;
    if (typeof r.num !== 'number') issue(issues, `${p}.num`, 'num is required');
    if (typeof r.hsn_sc !== 'string' || !r.hsn_sc.trim()) issue(issues, `${p}.hsn_sc`, 'HSN/SAC is required');
    if (typeof r.uqc !== 'string' || r.uqc.length < 3) issue(issues, `${p}.uqc`, 'uqc must be a 3-letter unit code');
    for (const key of ['qty', 'rt', 'txval', 'iamt', 'camt', 'samt', 'csamt']) {
      if (r[key] !== undefined && typeof r[key] !== 'number') issue(issues, `${p}.${key}`, `${key} must be a number`);
    }
    for (const key of ['txval', 'iamt', 'camt', 'samt', 'csamt']) {
      if (r[key] !== undefined && !isMoney(r[key])) {
        issue(issues, `${p}.${key}`, `${key} must be rounded to 2 decimal places`);
      }
    }
  });
}

export function validateGstr1(payload: unknown): Gstr1ValidationResult {
  const issues: Gstr1Issue[] = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, issues: [{ path: '$', message: 'payload must be an object' }] };
  }
  const doc = payload as Record<string, unknown>;

  if (typeof doc.gstin !== 'string' || !GSTIN_RE.test(doc.gstin)) {
    issue(issues, 'gstin', 'gstin must be a 15-character GSTIN');
  }
  if (typeof doc.fp !== 'string' || !FP_RE.test(doc.fp)) {
    issue(issues, 'fp', 'fp must be MMYYYY (e.g. 112026)');
  }
  if (doc.gt !== undefined && typeof doc.gt !== 'number') issue(issues, 'gt', 'gt must be a number');
  if (doc.cur_gt !== undefined && typeof doc.cur_gt !== 'number') issue(issues, 'cur_gt', 'cur_gt must be a number');

  if (doc.b2b !== undefined) {
    if (!Array.isArray(doc.b2b)) issue(issues, 'b2b', 'b2b must be an array');
    else {
      doc.b2b.forEach((entry, i) => {
        const e = entry as Record<string, unknown>;
        if (typeof e.ctin !== 'string' || !GSTIN_RE.test(e.ctin)) {
          issue(issues, `b2b[${i}].ctin`, 'ctin must be a valid GSTIN');
        }
        if (!Array.isArray(e.inv)) issue(issues, `b2b[${i}].inv`, 'inv must be an array');
        else e.inv.forEach((inv, j) => checkInvoice(issues, `b2b[${i}].inv[${j}]`, inv, { typ: 'b2b' }));
      });
    }
  }

  if (doc.b2cl !== undefined) {
    if (!Array.isArray(doc.b2cl)) issue(issues, 'b2cl', 'b2cl must be an array');
    else {
      doc.b2cl.forEach((entry, i) => {
        const e = entry as Record<string, unknown>;
        if (typeof e.pos !== 'string' || !POS_RE.test(e.pos)) {
          issue(issues, `b2cl[${i}].pos`, 'pos must be a 2-digit state code');
        }
        if (!Array.isArray(e.inv)) issue(issues, `b2cl[${i}].inv`, 'inv must be an array');
        else e.inv.forEach((inv, j) => checkInvoice(issues, `b2cl[${i}].inv[${j}]`, inv, { typ: 'b2cl' }));
      });
    }
  }

  if (doc.b2cs !== undefined) {
    if (!Array.isArray(doc.b2cs)) issue(issues, 'b2cs', 'b2cs must be an array');
    else {
      doc.b2cs.forEach((row, i) => {
        const r = row as Record<string, unknown>;
        const p = `b2cs[${i}]`;
        if (r.sply_ty !== 'INTRA' && r.sply_ty !== 'INTER') issue(issues, `${p}.sply_ty`, 'sply_ty must be INTRA or INTER');
        if (typeof r.pos !== 'string' || !POS_RE.test(r.pos)) issue(issues, `${p}.pos`, 'pos must be a 2-digit state code');
        if (r.typ !== 'OE' && r.typ !== 'E') issue(issues, `${p}.typ`, 'typ must be OE (or E)');
        for (const key of ['rt', 'txval', 'iamt', 'camt', 'samt', 'csamt']) {
          if (typeof r[key] !== 'number') issue(issues, `${p}.${key}`, `${key} must be a number`);
          else if (key !== 'rt' && !isMoney(r[key])) issue(issues, `${p}.${key}`, `${key} must be rounded to 2 decimal places`);
        }
      });
    }
  }

  if (!doc.hsn || typeof doc.hsn !== 'object') {
    issue(issues, 'hsn', 'hsn is required and must contain hsn_b2b / hsn_b2c arrays');
  } else {
    const hsn = doc.hsn as Record<string, unknown>;
    // Accept the older hsn.data shape only as a warning-level issue.
    if (hsn.data !== undefined && hsn.hsn_b2b === undefined) {
      issue(issues, 'hsn.data', 'use hsn.hsn_b2b and hsn.hsn_b2c (May 2025 onwards)');
    }
    if (hsn.hsn_b2b !== undefined) checkHsnRows(issues, 'hsn.hsn_b2b', hsn.hsn_b2b);
    if (hsn.hsn_b2c !== undefined) checkHsnRows(issues, 'hsn.hsn_b2c', hsn.hsn_b2c);
    if (hsn.hsn_b2b === undefined && hsn.hsn_b2c === undefined && hsn.data === undefined) {
      issue(issues, 'hsn', 'hsn must include hsn_b2b and/or hsn_b2c');
    }
  }

  if (!doc.doc_issue || typeof doc.doc_issue !== 'object') {
    issue(issues, 'doc_issue', 'doc_issue (Table 13 — documents issued) is required');
  } else {
    const block = doc.doc_issue as Record<string, unknown>;
    if (!Array.isArray(block.doc_det)) issue(issues, 'doc_issue.doc_det', 'doc_det must be an array');
    else {
      block.doc_det.forEach((det, i) => {
        const d = det as Record<string, unknown>;
        if (typeof d.doc_num !== 'number') issue(issues, `doc_issue.doc_det[${i}].doc_num`, 'doc_num is required');
        if (!Array.isArray(d.docs)) issue(issues, `doc_issue.doc_det[${i}].docs`, 'docs must be an array');
        else {
          d.docs.forEach((docRow, j) => {
            const r = docRow as Record<string, unknown>;
            const p = `doc_issue.doc_det[${i}].docs[${j}]`;
            for (const key of ['num', 'from', 'to', 'totnum', 'cancel', 'net_issue']) {
              if (r[key] === undefined || r[key] === null || r[key] === '') {
                issue(issues, `${p}.${key}`, `${key} is required`);
              }
            }
            if (typeof r.totnum === 'number' && typeof r.cancel === 'number' && typeof r.net_issue === 'number') {
              if (r.net_issue !== r.totnum - r.cancel) {
                issue(issues, `${p}.net_issue`, 'net_issue must equal totnum − cancel');
              }
            }
          });
        }
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

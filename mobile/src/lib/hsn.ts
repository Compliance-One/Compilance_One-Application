/**
 * Offline HSN search over a small bundled list of common shop goods.
 * Sources: zee4refer/hsn-sac-codes-india (codes, plain descriptions, search words)
 * joined with QuantumByteStudios/gst-hsn-sac-codes (CBIC rates), adjusted to
 * the Sept-2025 slabs (12%→5%, 28%→18%). Rates are a starting point only.
 */
import data from '../data/hsn.json';

export interface HsnEntry {
  code: string;
  description: string;
  /** Typical GST % (null when the heading has mixed rates). */
  rate: number | null;
  keywords: string;
}

const ENTRIES: HsnEntry[] = (data as Array<{ c: string; d: string; r: number | null; k?: string }>).map((e) => ({
  code: e.c,
  description: e.d,
  rate: e.r,
  keywords: e.k ?? '',
}));

export function allHsn(): HsnEntry[] {
  return ENTRIES;
}

/** Search by code prefix ("1006") or words in English, Hindi/Tanglish or Tamil ("rice", "arisi", "அரிசி"). */
export function searchHsn(query: string, limit = 30, entries: HsnEntry[] = ENTRIES): HsnEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, limit);
  if (/^\d+$/.test(q)) return entries.filter((e) => e.code.startsWith(q)).slice(0, limit);
  const words = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ e: HsnEntry; score: number }> = [];
  for (const e of entries) {
    const hay = `${e.description} ${e.keywords}`.toLowerCase();
    const tokens = hay.split(/[^a-z0-9\u0B80-\u0BFF]+/);
    let score = 0;
    for (const w of words) {
      if (tokens.includes(w)) score += 3;
      else if (tokens.some((t) => t.startsWith(w))) score += 2;
      else if (hay.includes(w)) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (score > 0) scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.e.code.localeCompare(b.e.code)).slice(0, limit).map((s) => s.e);
}

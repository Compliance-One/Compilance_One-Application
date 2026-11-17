import Fuse from 'fuse.js';

export interface CatalogProduct {
  id: string;
  name: string;
  sku?: string;
  hsnCode?: string;
  unit?: string;
  sellingPrice?: number;
  taxRate?: number;
}

export interface CatalogCustomer {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  stateCode?: string;
  stateName?: string;
  billingAddress?: string;
}

export interface ParsedVoiceItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  taxRate?: number;
  productId?: string;
  hsnCode?: string;
  matchedProductName?: string;
}

export interface ParsedVoiceBill {
  transcript: string;
  customerName?: string;
  customer?: CatalogCustomer;
  items: ParsedVoiceItem[];
}

const EN_ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const EN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const EN_SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  crore: 10000000,
  crores: 10000000,
};

const TA_NUMBERS: Record<string, number> = {
  'சுழியம்': 0,
  'பூஜ்ஜியம்': 0,
  'ஒன்று': 1,
  'ஒரு': 1,
  'இரண்டு': 2,
  'ரெண்டு': 2,
  'மூன்று': 3,
  'மூணு': 3,
  'நான்கு': 4,
  'நாலு': 4,
  'ஐந்து': 5,
  'அஞ்சு': 5,
  'ஆறு': 6,
  'ஆரு': 6,
  'ஏழு': 7,
  'எட்டு': 8,
  'ஒன்பது': 9,
  'பத்து': 10,
  'பதினொன்று': 11,
  'பதினொரு': 11,
  'பன்னிரண்டு': 12,
  'பன்னண்டு': 12,
  'பதிமூன்று': 13,
  'பதிநான்கு': 14,
  'பதினாலு': 14,
  'பதினைந்து': 15,
  'பதினஞ்சு': 15,
  'பதினாறு': 16,
  'பதினேழு': 17,
  'பதினெட்டு': 18,
  'பத்தொன்பது': 19,
  'இருபது': 20,
  'இருபத்து': 20,
  'முப்பது': 30,
  'முப்பத்து': 30,
  'நாற்பது': 40,
  'நாற்பத்து': 40,
  'ஐம்பது': 50,
  'ஐம்பத்து': 50,
  'அறுபது': 60,
  'அறுபத்து': 60,
  'எழுபது': 70,
  'எழுபத்து': 70,
  'எண்பது': 80,
  'எண்பத்து': 80,
  'தொண்ணூறு': 90,
  'தொண்ணூற்று': 90,
  'நூறு': 100,
  'நூற்று': 100,
  'ஆயிரம்': 1000,
  'ஆயிரத்து': 1000,
};

const UNIT_ALIASES: Record<string, string> = {
  pc: 'PCS',
  pcs: 'PCS',
  piece: 'PCS',
  pieces: 'PCS',
  nos: 'PCS',
  no: 'PCS',
  number: 'PCS',
  'துண்டு': 'PCS',
  'எண்': 'PCS',
  bag: 'BAG',
  bags: 'BAG',
  'பை': 'BAG',
  'பைகள்': 'BAG',
  kg: 'KG',
  kilo: 'KG',
  kilos: 'KG',
  kilogram: 'KG',
  kilograms: 'KG',
  'கிலோ': 'KG',
  ltr: 'LTR',
  liter: 'LTR',
  liters: 'LTR',
  litre: 'LTR',
  litres: 'LTR',
  'லிட்டர்': 'LTR',
  mtr: 'MTR',
  meter: 'MTR',
  meters: 'MTR',
  metre: 'MTR',
  metres: 'MTR',
  'மீட்டர்': 'MTR',
  box: 'BOX',
  boxes: 'BOX',
  'பெட்டி': 'BOX',
  'பெட்டிகள்': 'BOX',
  can: 'CAN',
  cans: 'CAN',
  'கேன்': 'CAN',
  set: 'SET',
  sets: 'SET',
  pkt: 'PKT',
  packet: 'PKT',
  packets: 'PKT',
  'பாக்கெட்': 'PKT',
  roll: 'ROLL',
  rolls: 'ROLL',
};

const PRICE_STOP = /^(at|each|for|rate|rs|inr|rupee|rupees|ரூபாய்|ரூ|விலை)$/i;
const GST_STOP = /^(with|gst|percent|percentage|vat|tax|சதவீதம்|ஜிஎஸ்டி)$/i;

function tokenize(text: string): string[] {
  return text
    .replace(/[%,]/g, ' ')
    .replace(/[–—]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseDigitToken(tok: string): number | null {
  const clean = tok.replace(/[₹,]/g, '');
  if (/^\d+(\.\d+)?$/.test(clean)) return Number(clean);
  return null;
}

/** Parse a run of English / Tamil number words plus digits into a single value. */
export function parseNumberPhrase(tokens: string[]): { value: number; consumed: number } | null {
  if (tokens.length === 0) return null;
  let i = 0;
  let total = 0;
  let current = 0;
  let used = false;

  const take = (): boolean => {
    if (i >= tokens.length) return false;
    const raw = tokens[i];
    const lower = raw.toLowerCase();
    const digit = parseDigitToken(raw);
    if (digit !== null) {
      current += digit;
      used = true;
      i += 1;
      return true;
    }
    if (lower in EN_ONES) {
      current += EN_ONES[lower];
      used = true;
      i += 1;
      return true;
    }
    if (lower in EN_TENS) {
      current += EN_TENS[lower];
      used = true;
      i += 1;
      return true;
    }
    if (lower in EN_SCALES) {
      const scale = EN_SCALES[lower];
      if (current === 0) current = 1;
      current *= scale;
      if (scale >= 1000) {
        total += current;
        current = 0;
      }
      used = true;
      i += 1;
      return true;
    }
    if (raw in TA_NUMBERS) {
      const n = TA_NUMBERS[raw];
      if (n === 100 || n === 1000) {
        if (current === 0) current = 1;
        current *= n;
        if (n >= 1000) {
          total += current;
          current = 0;
        }
      } else if (n >= 20 && n % 10 === 0) {
        current += n;
      } else {
        current += n;
      }
      used = true;
      i += 1;
      return true;
    }
    const parts = lower.split('-');
    if (parts.length === 2 && parts[0] in EN_TENS && parts[1] in EN_ONES) {
      current += EN_TENS[parts[0]] + EN_ONES[parts[1]];
      used = true;
      i += 1;
      return true;
    }
    return false;
  };

  while (take()) {
    /* consume */
  }
  if (!used) return null;
  return { value: total + current, consumed: i };
}

function looksLikeUnit(tok: string): string | null {
  const key = tok.toLowerCase();
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[tok] ?? null;
}

function extractCustomerClause(text: string): { name?: string; rest: string } {
  const patterns = [
    /(?:invoice\s+for|bill\s+(?:to|for)|customer(?:\s+name)?(?:\s+is)?|for\s+customer)\s+([^,]+?)(?:,|\.|$|add\s+\d|and\s+\d)/i,
    /வாடிக்கையாளர்(?:\s+பெயர்)?\s+([^,]+?)(?:,|\.|$)/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const name = m[1].trim().replace(/\s+(please|thanks|thank you)$/i, '');
      const rest = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim();
      return { name, rest };
    }
  }
  return { rest: text };
}

interface RawItem {
  quantity: number;
  unit: string;
  name: string;
  unitPrice?: number;
  taxRate?: number;
}

function parseSegment(segment: string): RawItem | null {
  const tokens = tokenize(segment);
  if (tokens.length === 0) return null;

  let quantity: number | undefined;
  let unit = 'PCS';
  let unitPrice: number | undefined;
  let taxRate: number | undefined;
  const nameTokens: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    if (GST_STOP.test(lower) || lower === 'with') {
      const ahead = parseNumberPhrase(tokens.slice(i + 1));
      if (ahead && ahead.value <= 100) {
        taxRate = ahead.value;
        i += 1 + ahead.consumed;
        while (i < tokens.length && GST_STOP.test(tokens[i])) i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (PRICE_STOP.test(lower)) {
      let j = i + 1;
      while (j < tokens.length && PRICE_STOP.test(tokens[j])) j += 1;
      const price = parseNumberPhrase(tokens.slice(j));
      if (price) {
        unitPrice = price.value;
        i = j + price.consumed;
        while (i < tokens.length && /^(each|apiece|only)$/i.test(tokens[i])) i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    const unitAlias = looksLikeUnit(tok);
    if (unitAlias) {
      unit = unitAlias;
      i += 1;
      continue;
    }

    const num = parseNumberPhrase(tokens.slice(i));
    if (num) {
      const after = tokens[i + num.consumed];
      const maybeUnit = after ? looksLikeUnit(after) : null;
      if (quantity === undefined) {
        quantity = num.value;
        i += num.consumed;
        if (maybeUnit) {
          unit = maybeUnit;
          i += 1;
        }
        continue;
      }
      if (unitPrice === undefined) {
        unitPrice = num.value;
        i += num.consumed;
        while (i < tokens.length && PRICE_STOP.test(tokens[i])) i += 1;
        continue;
      }
      i += num.consumed;
      continue;
    }

    if (!/^(add|please|and|plus|item|items|சேர்|மற்றும்)$/i.test(tok)) {
      nameTokens.push(tok);
    }
    i += 1;
  }

  const name = nameTokens.join(' ').trim();
  if (!name) return null;
  return {
    quantity: quantity ?? 1,
    unit,
    name,
    unitPrice,
    taxRate,
  };
}

function splitItems(text: string): string[] {
  return text
    .split(/\s+(?:and|,|மற்றும்|plus)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9஀-௿]+/g, ' ').trim();
}

/** Fraction of query tokens that appear in the candidate (prefix allowed). */
function tokenOverlap(query: string, candidate: string): number {
  const tokens = normalizeName(query).split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;
  const hay = normalizeName(candidate);
  const hayTokens = hay.split(/\s+/);
  let hits = 0;
  for (const tok of tokens) {
    if (hay.includes(tok) || hayTokens.some((h) => h.startsWith(tok) || tok.startsWith(h))) hits += 1;
  }
  return hits / tokens.length;
}

function matchProduct(name: string, products: CatalogProduct[]): CatalogProduct | undefined {
  if (products.length === 0 || !name) return undefined;
  let bestOverlap: { product: CatalogProduct; score: number } | undefined;
  for (const product of products) {
    const score = Math.max(tokenOverlap(name, product.name), product.sku ? tokenOverlap(name, product.sku) : 0);
    if (!bestOverlap || score > bestOverlap.score) bestOverlap = { product, score };
  }
  if (bestOverlap && bestOverlap.score >= 0.6) return bestOverlap.product;

  const fuse = new Fuse(products, {
    keys: ['name', 'sku'],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true,
  });
  const hits = fuse.search(name);
  const best = hits[0];
  if (best && (best.score ?? 1) <= 0.6) return best.item;
  return undefined;
}

function matchCustomer(name: string, customers: CatalogCustomer[]): CatalogCustomer | undefined {
  if (customers.length === 0 || !name) return undefined;
  const fuse = new Fuse(customers, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
  });
  const hits = fuse.search(name);
  const best = hits[0];
  if (best && (best.score ?? 1) <= 0.4) return best.item;
  return undefined;
}

export function parseTranscript(
  transcript: string,
  catalog: { products?: CatalogProduct[]; customers?: CatalogCustomer[] } = {}
): ParsedVoiceBill {
  const original = transcript.trim();
  const { name: spokenCustomer, rest } = extractCustomerClause(original);
  const segments = splitItems(rest);
  const products = catalog.products ?? [];
  const customers = catalog.customers ?? [];

  const items: ParsedVoiceItem[] = [];
  for (const segment of segments) {
    const raw = parseSegment(segment);
    if (!raw) continue;
    const product = matchProduct(raw.name, products);
    items.push({
      name: product?.name ?? raw.name,
      quantity: raw.quantity,
      unit: product?.unit || raw.unit,
      unitPrice: raw.unitPrice ?? product?.sellingPrice,
      taxRate: raw.taxRate ?? product?.taxRate ?? 18,
      productId: product?.id,
      hsnCode: product?.hsnCode,
      matchedProductName: product?.name,
    });
  }

  const customer = spokenCustomer ? matchCustomer(spokenCustomer, customers) : undefined;

  return {
    transcript: original,
    customerName: customer?.name ?? spokenCustomer,
    customer,
    items,
  };
}

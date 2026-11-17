import Fuse from 'fuse.js';

export interface CatalogProduct {
  id: string;
  name: string;
  sku?: string;
  hsnCode?: string;
  unit?: string;
  sellingPrice?: number;
  taxRate?: number;
  /** Extra spoken names (Tamil script / Tanglish), e.g. ["ஆணி","aani"]. */
  aliases?: string[];
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

/** Tamil numbers as people say them in English letters ("rendu kilo arisi aruvathu rupai"). */
const TA_ROMAN_NUMBERS: Record<string, number> = {
  onnu: 1, onru: 1, ondru: 1, oru: 1, oNNu: 1,
  rendu: 2, randu: 2, irandu: 2, erandu: 2,
  moonu: 3, munu: 3, moondru: 3, moonru: 3,
  naalu: 4, nalu: 4, naangu: 4, nangu: 4,
  anju: 5, ainthu: 5, aindhu: 5, anchu: 5,
  aaru: 6, aru: 6,
  ezhu: 7, elu: 7, yezhu: 7,
  ettu: 8, yettu: 8,
  ombodhu: 9, onbathu: 9, onbadhu: 9, ombathu: 9,
  pathu: 10, padhu: 10, paththu: 10,
  iruvathu: 20, irubathu: 20, iruvadhu: 20, irupathu: 20, irupadhu: 20,
  muppathu: 30, muppadhu: 30,
  narpathu: 40, naarpathu: 40, narpadhu: 40,
  aimbathu: 50, ambathu: 50, aimpathu: 50, aimbadhu: 50,
  aruvathu: 60, arubathu: 60, aruvadhu: 60, arupathu: 60,
  ezhupathu: 70, elupathu: 70, ezhubadhu: 70,
  enbathu: 80, embathu: 80, enbadhu: 80,
  thonnooru: 90, thonnuru: 90,
  nooru: 100, nuru: 100,
  aayiram: 1000, ayiram: 1000,
};

/** Fractions (arai kilo = half a kilo). Only used as a quantity. */
const FRACTIONS: Record<string, number> = {
  arai: 0.5, 'அரை': 0.5, half: 0.5,
  kaal: 0.25, 'கால்': 0.25, quarter: 0.25,
  mukkaal: 0.75, 'முக்கால்': 0.75,
};

const UNIT_ALIASES: Record<string, string> = {
  ennam: 'PCS',
  'எண்ணம்': 'PCS',
  'எண்ணிக்கை': 'PCS',
  g: 'GMS',
  gm: 'GMS',
  gms: 'GMS',
  gram: 'GMS',
  grams: 'GMS',
  'கிராம்': 'GMS',
  ml: 'ML',
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

const PRICE_STOP = /^(at|each|for|rate|rs|rs\.|inr|rupee|rupees|rupai|rupaai|rupa|roobai|ரூபாய்|ரூபாய்க்கு|ரூ|ரூ\.|விலை)$/i;
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
  const clean = tok.replace(/[₹,]/g, '').replace(/(rs|ரூ)\.?$/i, '').replace(/^(rs)\.?/i, '');
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
    // "45 2 kilo" is two numbers (price, then next quantity), so digits never chain.
    if (digit !== null && used) return false;
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
    if (raw in TA_NUMBERS || lower in TA_ROMAN_NUMBERS) {
      const n = raw in TA_NUMBERS ? TA_NUMBERS[raw] : TA_ROMAN_NUMBERS[lower];
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

function parseSegment(segment: string): RawItem[] {
  const tokens = tokenize(segment);
  const out: RawItem[] = [];
  if (tokens.length === 0) return out;

  let quantity: number | undefined;
  let unit = 'PCS';
  let unitPrice: number | undefined;
  let taxRate: number | undefined;
  let nameTokens: string[] = [];

  const flush = () => {
    const name = nameTokens.join(' ').trim();
    if (name) out.push({ quantity: quantity ?? 1, unit, name, unitPrice, taxRate });
    quantity = undefined;
    unit = 'PCS';
    unitPrice = undefined;
    taxRate = undefined;
    nameTokens = [];
  };

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    const frac = FRACTIONS[lower] ?? FRACTIONS[tok];
    if (frac !== undefined && quantity === undefined) {
      quantity = frac;
      i += 1;
      continue;
    }

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
      // Recognisers often drop commas: "2 kilo rice 60 1 sugar 45". A number after a
      // complete item (name + price), or a number followed by a unit once we already
      // have a name and quantity, starts the next item.
      const itemDone = nameTokens.length > 0 && quantity !== undefined && (unitPrice !== undefined || !!maybeUnit);
      if (itemDone) flush();
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

  flush();
  return out;
}

function splitItems(text: string): string[] {
  return text
    .split(/\s*[,;.\n]\s*|\s+(?:and|மற்றும்|plus|apram|aprom|அப்புறம்)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9஀-௿]+/g, ' ').trim();
}

/** Singular form for matching: "screws" -> "screw", "boxes" -> "box". */
export function singular(tok: string): string {
  if (!/^[a-z]+$/.test(tok) || tok.length <= 3) return tok;
  if (/(sh|ch|x|z|ss)es$/.test(tok)) return tok.slice(0, -2);
  if (tok.endsWith('ies') && tok.length > 4) return tok.slice(0, -3) + 'y';
  if (tok.endsWith('s') && !tok.endsWith('ss')) return tok.slice(0, -1);
  return tok;
}

function tokensOf(s: string): string[] {
  return normalizeName(s).split(/\s+/).filter((t) => t.length > 1).map(singular);
}

/**
 * How well the query's words appear in the candidate: an exact word counts 1,
 * a prefix of 3+ letters counts 0.8. A tiny bonus for covering more of the
 * candidate breaks ties ("tap" prefers "Water Tap" over "Teflon Tape").
 */
export function tokenOverlap(query: string, candidate: string): number {
  const tokens = tokensOf(query);
  if (tokens.length === 0) return 0;
  const hayTokens = tokensOf(candidate);
  if (hayTokens.length === 0) return 0;
  let hits = 0;
  let covered = 0;
  for (const tok of tokens) {
    if (hayTokens.includes(tok)) {
      hits += 1;
      covered += 1;
    } else if (tok.length >= 3 && hayTokens.some((h) => h.length >= 3 && (h.startsWith(tok) || tok.startsWith(h)))) {
      hits += 0.8;
    }
  }
  return hits / tokens.length + (covered / hayTokens.length) * 0.01;
}

function productScore(name: string, product: CatalogProduct): number {
  let best = tokenOverlap(name, product.name);
  if (product.sku) best = Math.max(best, tokenOverlap(name, product.sku));
  for (const a of product.aliases ?? []) best = Math.max(best, tokenOverlap(name, a) - 0.005);
  return best;
}

/** Common kirana words: Tamil script / Tanglish -> English, so "arisi" finds "Rice". */
const NAME_ALIASES: Record<string, string[]> = {
  rice: ['arisi', 'அரிசி'],
  sugar: ['sakkarai', 'sarkarai', 'சர்க்கரை', 'சக்கரை', 'cheeni', 'jeeni'],
  salt: ['uppu', 'உப்பு'],
  oil: ['ennai', 'ennei', 'எண்ணெய்', 'எண்ணை'],
  dal: ['paruppu', 'பருப்பு', 'dhal'],
  milk: ['paal', 'pal', 'பால்'],
  egg: ['muttai', 'முட்டை', 'eggs'],
  flour: ['maavu', 'mavu', 'மாவு', 'atta'],
  tea: ['tea thool', 'டீ', 'தேயிலை'],
  coffee: ['kaapi', 'kapi', 'காபி'],
  onion: ['vengayam', 'வெங்காயம்'],
  tomato: ['thakkali', 'தக்காளி'],
  potato: ['urulaikizhangu', 'urulai', 'உருளைக்கிழங்கு'],
  soap: ['sopu', 'soppu', 'சோப்பு'],
  biscuit: ['biscuits', 'பிஸ்கட்'],
  chilli: ['milagai', 'மிளகாய்', 'chili'],
  turmeric: ['manjal', 'மஞ்சள்'],
  wheat: ['godhumai', 'gothumai', 'கோதுமை'],
  jaggery: ['vellam', 'வெல்லம்'],
  cement: ['சிமெண்ட்', 'siment'],
};

const ALIAS_INDEX: Record<string, string[]> = (() => {
  const idx: Record<string, string[]> = {};
  for (const [en, words] of Object.entries(NAME_ALIASES)) {
    const group = [en, ...words];
    for (const w of group) idx[w.toLowerCase()] = group;
  }
  return idx;
})();

/** The spoken name plus its English/Tamil equivalents, e.g. "arisi" -> ["arisi","rice","அரிசி"]. */
export function nameVariants(name: string): string[] {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  const variants = new Set<string>([name]);
  for (const w of words) {
    const group = ALIAS_INDEX[w];
    if (group) for (const g of group) variants.add(name.toLowerCase().replace(w, g));
  }
  return [...variants];
}

function matchProduct(name: string, products: CatalogProduct[]): CatalogProduct | undefined {
  if (products.length === 0 || !name) return undefined;
  for (const variant of nameVariants(name)) {
    const hit = matchProductOne(variant, products);
    if (hit) return hit;
  }
  return undefined;
}

function matchProductOne(name: string, products: CatalogProduct[]): CatalogProduct | undefined {
  let bestOverlap: { product: CatalogProduct; score: number } | undefined;
  for (const product of products) {
    const score = productScore(name, product);
    if (!bestOverlap || score > bestOverlap.score) bestOverlap = { product, score };
  }
  if (bestOverlap && bestOverlap.score >= 0.6) return bestOverlap.product;

  const fuse = new Fuse(products, {
    keys: ['name', 'sku', 'aliases'],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
  });
  const hits = fuse.search(name);
  const best = hits[0];
  if (best && (best.score ?? 1) <= 0.35) return best.item;
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
   for (const raw of parseSegment(segment)) {
    const product = matchProduct(raw.name, products);
    items.push({
      name: product?.name ?? raw.name,
      quantity: raw.quantity,
      unit: product?.unit || raw.unit,
      unitPrice: raw.unitPrice ?? product?.sellingPrice,
      // Unknown items default to 0% GST; the owner can change it on the bill.
      taxRate: raw.taxRate ?? product?.taxRate ?? 0,
      productId: product?.id,
      hsnCode: product?.hsnCode,
      matchedProductName: product?.name,
    });
   }
  }

  const customer = spokenCustomer ? matchCustomer(spokenCustomer, customers) : undefined;

  return {
    transcript: original,
    customerName: customer?.name ?? spokenCustomer,
    customer,
    items,
  };
}

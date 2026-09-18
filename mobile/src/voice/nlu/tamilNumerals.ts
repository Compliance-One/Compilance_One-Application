/**
 * Member 2 — NLU Pipeline
 * mobile/src/voice/nlu/tamilNumerals.ts
 *
 * Converts Tamil word-numbers (spoken) into integers.
 * Handles simple and compound forms.
 *
 * Examples:
 *   "ஐந்து"              → 5
 *   "பத்து"              → 10
 *   "இருபத்தி ஐந்து"    → 25
 *   "நூறு"               → 100
 *   "ஆயிரம்"             → 1000
 */

// ─── Base numeral map ────────────────────────────────────────────────────────
const UNITS: Record<string, number> = {
  'ஒன்று':        1,
  'ஒரு':          1,
  'இரண்டு':       2,
  'மூன்று':       3,
  'நான்கு':       4,
  'ஐந்து':        5,
  'ஆறு':          6,
  'ஏழு':          7,
  'எட்டு':        8,
  'ஒன்பது':       9,
  'பத்து':        10,
  'பதினொன்று':    11,
  'பன்னிரண்டு':  12,
  'பதிமூன்று':   13,
  'பதினான்கு':   14,
  'பதினைந்து':   15,
  'பதினாறு':     16,
  'பதினேழு':     17,
  'பதினெட்டு':   18,
  'பத்தொன்பது':  19,
  'இருபது':       20,
  'முப்பது':      30,
  'நாற்பது':      40,
  'ஐம்பது':       50,
  'அறுபது':       60,
  'எழுபது':       70,
  'எண்பது':       80,
  'தொண்ணூறு':     90,
  'நூறு':         100,
  'இருநூறு':      200,
  'முன்னூறு':     300,
  'நானூறு':       400,
  'ஐந்நூறு':      500,
  'அறுநூறு':      600,
  'எழுநூறு':      700,
  'எண்ணூறு':      800,
  'தொள்ளாயிரம்':  900,
  'ஆயிரம்':      1000,
  'பதினாயிரம்':  10000,
  'இலட்சம்':     100000,
  'லட்சம்':      100000,
};

// Compound tens prefixes: "இருபத்தி" → 20, "முப்பத்தி" → 30 …
const TENS_PREFIX: Record<string, number> = {
  'இருபத்தி':   20,
  'முப்பத்தி':  30,
  'நாற்பத்தி':  40,
  'ஐம்பத்தி':   50,
  'அறுபத்தி':   60,
  'எழுபத்தி':   70,
  'எண்பத்தி':   80,
  'தொண்ணூத்தி':  90,
};

/**
 * Attempts to parse a single Tamil numeral token (word or digit string).
 * Returns the integer value, or null if not recognized.
 */
export function parseSingleTamilNumeral(token: string): number | null {
  // Plain Arabic digits
  const n = Number(token);
  if (!isNaN(n) && token.length > 0) return n;

  // Direct lookup
  if (UNITS[token] !== undefined) return UNITS[token];

  return null;
}

/**
 * Parses a sequence of tokens that may form a compound Tamil numeral.
 * Returns { value, consumedCount } or null if no numeral found.
 *
 * Handles patterns like:
 *   ["இருபத்தி", "ஐந்து"]  → { value: 25, consumedCount: 2 }
 *   ["1500"]                  → { value: 1500, consumedCount: 1 }
 */
export function parseTamilNumber(
  tokens: string[],
  startIndex = 0,
): { value: number; consumedCount: number } | null {
  const token = tokens[startIndex];
  if (!token) return null;

  // Compound tens (e.g. "இருபத்தி ஐந்து")
  if (TENS_PREFIX[token] !== undefined) {
    const tens = TENS_PREFIX[token];
    const nextToken = tokens[startIndex + 1];
    if (nextToken && UNITS[nextToken] !== undefined && UNITS[nextToken] < 10) {
      return { value: tens + UNITS[nextToken], consumedCount: 2 };
    }
    return { value: tens, consumedCount: 1 };
  }

  // Single numeral
  const single = parseSingleTamilNumeral(token);
  if (single !== null) return { value: single, consumedCount: 1 };

  return null;
}

/**
 * Member 2 — NLU Pipeline
 * mobile/src/voice/nlu/tokenizer.ts
 *
 * Splits a Tamil (or mixed) utterance into clean tokens.
 * Strips GST-billing-specific stopwords before returning.
 *
 * Example:
 *   "ரேமெக்கு 2 அரிசி மூட்டை 1500 ரூபாய்"
 *   → ["ரேமெக்கு", "2", "அரிசி", "மூட்டை", "1500"]
 */

// Common Tamil stopwords in billing context that carry no semantic value
const STOP_WORDS = new Set([
  'ரூபாய்',     // rupees
  'ரூ',
  'rs',
  'rs.',
  'rupees',
  'கு',          // to/for (suffix)
  'க்கு',
  'யில்',        // in/at (suffix)
  'தா',          // marker
  'தான்',
  'ஒரு',         // one (article use)
  'மொத்தம்',    // total
  'total',
  'amount',
  'and',
  'மற்றும்',    // and
  ',',
  '.',
  'ல',
  'ல்',
]);

/**
 * Tokenizes a raw utterance into meaningful tokens.
 * Handles Tamil Unicode characters, digits, and English words.
 *
 * @param utterance  Raw STT transcript string
 * @returns          Array of cleaned, non-empty tokens
 */
export function tokenize(utterance: string): string[] {
  // Normalize: lowercase English, trim
  const normalized = utterance.trim().toLowerCase();

  // Split on whitespace and common punctuation
  const raw = normalized.split(/[\s,،؛]+/);

  return raw
    .map((t) => t.trim().replace(/[.,;:!?'"()]+/g, ''))
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/**
 * Checks if a token is a pure number (Arabic digits).
 */
export function isNumericToken(token: string): boolean {
  return /^\d+(\.\d+)?$/.test(token);
}

/**
 * Checks if a token looks like a Tamil word (contains Tamil Unicode range U+0B80–U+0BFF).
 */
export function isTamilToken(token: string): boolean {
  return /[\u0B80-\u0BFF]/.test(token);
}

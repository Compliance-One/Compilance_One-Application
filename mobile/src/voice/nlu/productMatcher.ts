/**
 * Member 2 — NLU Pipeline
 * mobile/src/voice/nlu/productMatcher.ts
 *
 * Fuzzy-matches a spoken product name token against the local product master
 * using fuse.js. Called by the NLU parser after numerals are extracted.
 *
 * Example:
 *   token: "அரிசி"  + products list → { product: {name: "அரிசி மூட்டை", ...}, score: 0.9 }
 */

import Fuse from 'fuse.js';
import type { Product } from '../../db/schema';

export interface MatchResult {
  product: Product;
  score:   number;  // 0.0 (no match) – 1.0 (perfect match)
}

// Fuse.js options tuned for Tamil product names
const FUSE_OPTIONS: any = {
  keys:             ['name'],
  threshold:        0.4,         // 0 = exact, 1 = match anything; 0.4 is lenient
  includeScore:     true,
  minMatchCharLength: 2,
  ignoreLocation:   true,        // don't penalize match position
};

let _fuse: Fuse<Product> | null = null;

/**
 * Initializes the Fuse index from the current product master.
 * Call this once when the app loads products from SQLite,
 * and again whenever the product list changes.
 */
export function buildProductIndex(products: Product[]): void {
  _fuse = new Fuse(products, FUSE_OPTIONS);
}

/**
 * Fuzzy-matches a spoken token to the product list.
 * Returns the best match above threshold, or null.
 *
 * @param token     Single spoken word or phrase for a product name
 * @param products  Optional override (rebuilds index if provided)
 */
export function matchProduct(
  token: string,
  products?: Product[],
): MatchResult | null {
  if (products) buildProductIndex(products);
  if (!_fuse) return null;

  const results = _fuse.search(token);
  if (results.length === 0) return null;

  const best = results[0];
  if (!best.item || best.score === undefined) return null;

  // Fuse score: 0 = perfect, 1 = worst — invert to a 0–1 confidence scale
  const score = 1 - best.score;
  if (score < 0.6) return null; // reject weak matches

  return { product: best.item, score };
}

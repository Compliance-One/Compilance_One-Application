/**
 * Member 2 — NLU Pipeline
 * mobile/src/voice/nlu/confidenceScorer.ts
 *
 * Computes a 0–100 confidence score for a parsed NLU result.
 * confidence = (resolvedTokens / totalMeaningfulTokens) × 100
 *
 * A score < 60 triggers the "Review & Edit" prompt on VoiceBilling screen,
 * telling the shopkeeper that the app isn't sure about some items.
 */

export interface ResolvedToken {
  token:    string;
  resolved: boolean;  // true if mapped to product, qty, or amount
  type?:    'product' | 'quantity' | 'amount';
}

/**
 * Scores how many tokens were successfully resolved into structured data.
 *
 * @param tokens    All tokens from the tokenizer
 * @param resolved  Per-token resolution results from the NLU parser
 * @returns         Integer 0–100
 */
export function scoreConfidence(
  tokens: string[],
  resolved: ResolvedToken[],
): number {
  if (tokens.length === 0) return 0;

  const totalMeaningful = tokens.length;
  const totalResolved   = resolved.filter((r) => r.resolved).length;

  return Math.round((totalResolved / totalMeaningful) * 100);
}

/**
 * Returns a human-readable label for a confidence score.
 * Used by the VoiceBilling screen confidence indicator.
 */
export function confidenceLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 80) return { label: 'High Confidence',   color: '#2E7D32' };
  if (score >= 60) return { label: 'Medium Confidence', color: '#F57F17' };
  return              { label: 'Low — Please Review', color: '#B71C1C' };
}

/**
 * Returns true if the NLU result is confident enough to auto-proceed
 * to invoice creation without showing a review prompt.
 */
export function isAutoAcceptable(score: number): boolean {
  return score >= 80;
}

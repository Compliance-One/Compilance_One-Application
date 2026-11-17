/**
 * Pure helpers for the speech recogniser's result events.
 *
 * - `results` is a list of ALTERNATIVES for the same speech, not separate
 *   phrases. Joining them turned "rice" into "rice rice rice". Use the first.
 * - Only FINAL results are committed; interim ones are just a live preview.
 * - Some Android engines repeat the same final (or re-send earlier words in
 *   the next final). `freshFinal` returns only the new words, or null.
 */

export function bestTranscript(results: Array<{ transcript?: string }> | undefined): string {
  return (results?.[0]?.transcript ?? '').replace(/\s+/g, ' ').trim();
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function freshFinal(lastCommitted: string, text: string): string | null {
  const t = norm(text);
  if (!t) return null;
  const last = norm(lastCommitted);
  if (!last) return t;
  if (t === last) return null;
  if (t.startsWith(last + ' ')) return t.slice(last.length).trim() || null;
  return t;
}

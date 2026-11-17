import en from '../i18n/en.json';
import ta from '../i18n/ta.json';

function keysOf(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) return [prefix];
  return entries.flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n catalogues', () => {
  it('has the same key set in English and Tamil', () => {
    const enKeys = keysOf(en).sort();
    const taKeys = keysOf(ta).sort();
    const missingInTa = enKeys.filter((k) => !taKeys.includes(k));
    const extraInTa = taKeys.filter((k) => !enKeys.includes(k));
    expect({ missingInTa, extraInTa }).toEqual({ missingInTa: [], extraInTa: [] });
  });
});

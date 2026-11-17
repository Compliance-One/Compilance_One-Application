import { useTranslation } from 'react-i18next';

/**
 * Tamil-first labels with the other language underneath.
 * Returns [main, sub] for a translation key.
 */
export function useBilingual() {
  const { t, i18n } = useTranslation();
  const other = i18n.language.startsWith('ta') ? 'en' : 'ta';
  const tOther = i18n.getFixedT(other);
  return (key: string, opts?: Record<string, unknown>): [string, string] => [
    t(key, opts) as string,
    tOther(key, opts) as string,
  ];
}

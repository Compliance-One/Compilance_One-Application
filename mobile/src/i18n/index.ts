import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import ta from './ta.json';

export const LANG_STORAGE_KEY = 'compliance-one.language';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function hydrateLanguage(): Promise<'en' | 'ta'> {
  try {
    const saved = await AsyncStorage.getItem(LANG_STORAGE_KEY);
    const lng: 'en' | 'ta' = saved === 'ta' ? 'ta' : 'en';
    if (i18n.language !== lng) await i18n.changeLanguage(lng);
    return lng;
  } catch {
    return 'en';
  }
}

export async function persistLanguage(lng: 'en' | 'ta'): Promise<void> {
  await i18n.changeLanguage(lng);
  try {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* storage unavailable — language still applies this session */
  }
}

export default i18n;

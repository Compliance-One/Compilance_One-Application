import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaperWidthMm } from './receiptFormatter';

export const PRINTER_STORAGE_KEY = 'compliance-one.printer';

export interface SavedPrinter {
  name: string;
  address: string;
  deviceType: string;
  paperWidthMm: PaperWidthMm;
}

export async function loadSavedPrinter(): Promise<SavedPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPrinter;
    if (!parsed.address) return null;
    return {
      name: parsed.name || 'Printer',
      address: parsed.address,
      deviceType: parsed.deviceType || 'unknown',
      paperWidthMm: parsed.paperWidthMm === 80 ? 80 : 58,
    };
  } catch {
    return null;
  }
}

export async function saveSelectedPrinter(printer: SavedPrinter): Promise<void> {
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printer));
}

export async function clearSelectedPrinter(): Promise<void> {
  await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
}

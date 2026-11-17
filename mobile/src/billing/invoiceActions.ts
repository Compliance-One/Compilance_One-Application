import { Alert } from 'react-native';
import { getDb } from '../db/schema';
import { getInvoiceDetail } from '../db/repositories';
import { printInvoice } from '../print/bluetoothPrinter';
import { shareInvoicePdf } from '../pdf/shareInvoicePdf';

export async function shareInvoicePdfById(invoiceId: string): Promise<void> {
  const db = await getDb();
  const detail = await getInvoiceDetail(db, invoiceId);
  if (!detail) throw new Error('Invoice not found on this device.');
  await shareInvoicePdf(detail);
}

export async function printInvoiceById(invoiceId: string): Promise<void> {
  const db = await getDb();
  const detail = await getInvoiceDetail(db, invoiceId);
  if (!detail) throw new Error('Invoice not found on this device.');
  await printInvoice(detail);
}

export function alertActionError(err: unknown, title = 'Could not complete'): void {
  Alert.alert(title, err instanceof Error ? err.message : String(err));
}

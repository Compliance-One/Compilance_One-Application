import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { InvoiceDocument } from '../billing/invoiceDocument';
import { buildInvoiceHtml } from './invoiceHtml';

export async function generateInvoicePdf(invoice: InvoiceDocument): Promise<{ uri: string; html: string }> {
  const html = buildInvoiceHtml(invoice);
  const result = await Print.printToFileAsync({ html, base64: false });
  return { uri: result.uri, html };
}

export async function shareInvoicePdf(invoice: InvoiceDocument): Promise<string> {
  const { uri } = await generateInvoicePdf(invoice);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Tax Invoice ${invoice.invoiceNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

import i18n from '../i18n';
import { PermissionsAndroid, Platform } from 'react-native';
import type { InvoiceDocument } from '../billing/invoiceDocument';
import { buildReceipt, type PaperWidthMm, type ReceiptNode } from './receiptFormatter';
import { loadSavedPrinter, type SavedPrinter } from './printerStore';

export interface DiscoveredPrinter {
  name: string;
  address: string;
  deviceType: string;
  source: 'paired' | 'found';
}

async function loadDriver() {
  try {
    return await import('react-native-thermal-printer-driver');
  } catch {
    throw new Error(
      'The thermal printer driver is only available in a development build. Expo Go is not supported.'
    );
  }
}

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  try {
    if (api >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    const loc = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return loc === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function scanPrinters(): Promise<DiscoveredPrinter[]> {
  const granted = await requestBluetoothPermissions();
  if (!granted) {
    throw new Error(i18n.t('receipt.permissionDenied'));
  }
  const driver = await loadDriver();
  const { paired, found } = await driver.default.scan();
  const seen = new Set<string>();
  const out: DiscoveredPrinter[] = [];
  for (const src of [
    ...(paired ?? []).map((d: { name: string; address: string; deviceType?: string }) => ({ ...d, source: 'paired' as const })),
    ...(found ?? []).map((d: { name: string; address: string; deviceType?: string }) => ({ ...d, source: 'found' as const })),
  ]) {
    if (seen.has(src.address)) continue;
    seen.add(src.address);
    out.push({
      name: src.name || 'Unknown printer',
      address: src.address,
      deviceType: src.deviceType || 'unknown',
      source: src.source,
    });
  }
  return out;
}

export async function stopPrinterScan(): Promise<void> {
  try {
    const driver = await loadDriver();
    await driver.default.stopScan();
  } catch {
    /* not scanning */
  }
}

function toDriverNodes(nodes: ReceiptNode[], driver: Awaited<ReturnType<typeof loadDriver>>) {
  return nodes.map((node) => {
    if (node.type === 'text') {
      return driver.text(node.value, {
        align: node.align ?? 'left',
        bold: !!node.bold,
        size: node.size ?? 1,
      });
    }
    if (node.type === 'line') {
      return driver.line({ style: node.style ?? 'solid' });
    }
    if (node.type === 'feed') {
      return driver.feed(node.lines ?? 1);
    }
    return driver.cut();
  });
}

export async function printInvoice(
  invoice: InvoiceDocument,
  printer?: SavedPrinter | null
): Promise<void> {
  const saved = printer ?? (await loadSavedPrinter());
  if (!saved) {
    throw new Error(i18n.t('receipt.noPrinter'));
  }
  const granted = await requestBluetoothPermissions();
  if (!granted) {
    throw new Error(i18n.t('receipt.permissionDenied'));
  }
  const paperWidthMm: PaperWidthMm = saved.paperWidthMm === 80 ? 80 : 58;
  const receipt = buildReceipt(invoice, paperWidthMm);
  const driver = await loadDriver();
  const ThermalPrinter = driver.default;
  try {
    const connected = await ThermalPrinter.isConnected(saved.address);
    if (!connected) {
      await ThermalPrinter.connect(saved.address, { timeout: 10000 });
    }
    await ThermalPrinter.print(saved.address, toDriverNodes(receipt.nodes, driver), {
      paperWidthMm,
      keepAlive: true,
      timeout: 20000,
    });
  } catch (err) {
    // Fall back to raw ESC/POS if the high-level node API fails.
    try {
      const connected = await ThermalPrinter.isConnected(saved.address);
      if (!connected) await ThermalPrinter.connect(saved.address, { timeout: 10000 });
      await ThermalPrinter.printRaw(saved.address, Array.from(receipt.bytes), { timeout: 20000 });
    } catch {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, typo } from '../../theme';
import { Card, PrimaryButton, SecondaryButton, SectionTitle, Segmented } from '../../components/reports/ui';
import {
  scanPrinters,
  stopPrinterScan,
  printInvoice,
  type DiscoveredPrinter,
} from '../../print/bluetoothPrinter';
import {
  clearSelectedPrinter,
  loadSavedPrinter,
  saveSelectedPrinter,
  type SavedPrinter,
} from '../../print/printerStore';
import type { PaperWidthMm } from '../../print/receiptFormatter';
import { sampleInvoice } from '../../billing/sampleInvoice';

export default function PrinterPanel() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<SavedPrinter | null>(null);
  const [found, setFound] = useState<DiscoveredPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSavedPrinter().then(setSaved);
    return () => {
      void stopPrinterScan();
    };
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const devices = await scanPrinters();
      setFound(devices);
      if (devices.length === 0) Alert.alert(t('printer.noneFound'));
    } catch (e) {
      Alert.alert(t('printer.title'), e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }, [t]);

  async function select(device: DiscoveredPrinter) {
    const next: SavedPrinter = {
      name: device.name,
      address: device.address,
      deviceType: device.deviceType,
      paperWidthMm: saved?.paperWidthMm ?? 58,
    };
    await saveSelectedPrinter(next);
    setSaved(next);
  }

  async function setWidth(width: PaperWidthMm) {
    if (!saved) {
      setSaved({ name: '', address: '', deviceType: 'unknown', paperWidthMm: width });
      return;
    }
    const next = { ...saved, paperWidthMm: width };
    if (saved.address) await saveSelectedPrinter(next);
    setSaved(next);
  }

  async function testPrint() {
    if (!saved?.address) {
      Alert.alert(t('printer.noneSelected'));
      return;
    }
    setBusy(true);
    try {
      await printInvoice(sampleInvoice({ invoiceNumber: 'TEST' }), saved);
      Alert.alert(t('printer.testSent'));
    } catch (e) {
      Alert.alert(t('printer.title'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle>{t('printer.title')}</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('printer.hint')}</Text>
        <Text style={typo.bodyStrong}>
          {saved?.address ? `${saved.name} (${saved.address})` : t('printer.noneSelected')}
        </Text>
        <Segmented<'58' | '80'>
          value={String(saved?.paperWidthMm ?? 58) as '58' | '80'}
          onChange={(w) => void setWidth(w === '80' ? 80 : 58)}
          options={[
            { value: '58', label: '58mm' },
            { value: '80', label: '80mm' },
          ]}
        />
        <PrimaryButton label={scanning ? t('printer.scanning') : t('printer.scan')} onPress={() => void scan()} busy={scanning} />
        {found.map((d) => (
          <TouchableOpacity key={d.address} onPress={() => void select(d)} style={{ paddingVertical: 8 }}>
            <Text style={typo.bodyStrong}>{d.name}</Text>
            <Text style={[typo.caption, { color: colors.inkSoft }]}>
              {d.address} · {d.source} · {d.deviceType}
            </Text>
          </TouchableOpacity>
        ))}
        {saved?.address ? (
          <View style={{ gap: space.sm }}>
            <SecondaryButton label={busy ? t('printer.printing') : t('printer.test')} onPress={() => void testPrint()} />
            <SecondaryButton
              label={t('printer.clear')}
              onPress={() => {
                void clearSelectedPrinter();
                setSaved((prev) => (prev ? { ...prev, address: '', name: '' } : prev));
              }}
            />
          </View>
        ) : null}
        {scanning ? <ActivityIndicator color={colors.leaf} /> : null}
      </Card>
    </>
  );
}

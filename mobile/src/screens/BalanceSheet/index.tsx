/**
 * Balance Sheet (இருப்பு நிலைக் குறிப்பு) — uses getBalanceSheet() from
 * db/views/balanceSheet.ts. cashAndBank is always 0 until a cash ledger
 * table exists — this screen shows a small note rather than hiding that.
 * TODO (integration): wire db/businessId context.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { BalanceSheet } from '../../db/views/balanceSheet';

export default function BalanceSheetScreen() {
  const { t } = useTranslation();
  const [bs] = useState<BalanceSheet | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('balanceSheet.title')}</Text>
      <Row label={t('balanceSheet.cashAndBank')} value={bs?.cashAndBank ?? 0} />
      <Text style={styles.note}>Cash/bank tracking not yet implemented in the schema.</Text>
      <Row label={t('balanceSheet.stockValue')} value={bs?.stockValue ?? 0} />
      <Row label={t('balanceSheet.receivables')} value={bs?.receivables ?? 0} />
      <Row label={t('balanceSheet.payables')} value={bs?.payables ?? 0} />
      <Row label={t('balanceSheet.ownersCapital')} value={bs?.ownersCapital ?? 0} bold />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={bold && styles.bold}>{label}</Text>
      <Text style={bold && styles.bold}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  bold: { fontWeight: '700' },
  note: { fontSize: 11, color: '#999', marginBottom: 8 },
});

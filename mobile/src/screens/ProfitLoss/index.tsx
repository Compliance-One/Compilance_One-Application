/**
 * Profit & Loss (இலாப நஷ்ட கணக்கு) — uses getProfitAndLoss() from
 * db/views/profitLoss.ts for a selected period.
 * TODO (integration): wire date picker + db/businessId context.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProfitAndLoss } from '../../db/views/profitLoss';

export default function ProfitLossScreen() {
  const { t } = useTranslation();
  const [pl] = useState<ProfitAndLoss | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profitLoss.title')}</Text>
      <Row label={t('profitLoss.income')} value={pl?.totalIncome ?? 0} />
      <Row label={t('profitLoss.expense')} value={pl?.totalExpense ?? 0} />
      <Row label={t('profitLoss.netProfit')} value={pl?.netProfit ?? 0} bold />
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
});

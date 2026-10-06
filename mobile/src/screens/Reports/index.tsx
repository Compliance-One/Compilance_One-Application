/**
 * Reports — GST summary (CGST/SGST/IGST) for a selected period.
 * TODO (integration): wire date picker + db/businessId context like Dashboard.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const [summary] = useState({ cgst: 0, sgst: 0, igst: 0 });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('reports.title')}</Text>
      <Row label={t('reports.cgst')} value={summary.cgst} />
      <Row label={t('reports.sgst')} value={summary.sgst} />
      <Row label={t('reports.igst')} value={summary.igst} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  value: { fontWeight: '600' },
});

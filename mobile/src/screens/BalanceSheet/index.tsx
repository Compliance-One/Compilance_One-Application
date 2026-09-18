/**
 * Member 4 — Screens
 * mobile/src/screens/BalanceSheet/index.tsx
 *
 * Balance Sheet report.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { getBalanceSheet, BalanceSheetReport } from '../../db/views/balanceSheet';

export default function BalanceSheetScreen() {
  const business = useAppStore((s) => s.business);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);

  useEffect(() => {
    if (!business) return;
    getBalanceSheet(business.id).then(setReport).catch(console.error);
  }, [business]);

  if (!report) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>⚖️ Balance Sheet</Text>
        <Text style={styles.period}>As of {report.asOf}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionHead}>Assets (What you own)</Text>
          <Row label="Cash & Bank" value={report.assets.cashAndBank} />
          <Row label="Stock Value" value={report.assets.stockValue} />
          <Row label="Receivables" value={report.assets.receivables} />
          <View style={styles.divider} />
          <Row label="Total Assets" value={report.assets.totalAssets} bold />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHead}>Liabilities (What you owe)</Text>
          <Row label="Payables" value={report.liabilities.payables} />
          <View style={styles.divider} />
          <Row label="Total Liabilities" value={report.liabilities.totalLiabilities} bold />
        </View>

        <View style={[styles.card, { backgroundColor: '#E3F2FD' }]}>
          <Row 
            label="OWNER'S CAPITAL" 
            value={report.ownersCapital} 
            bold 
            color="#1565C0" 
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold = false, color = '#212121' }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, bold && styles.bold, { color }]}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold, { color }]}>₹{value.toFixed(2)}</Text>
    </View>
  );
}

const GREEN = '#1B5E20';
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FBE7' },
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '900', color: GREEN },
  period: { fontSize: 13, color: '#757575', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, elevation: 1 },
  sectionHead: { fontSize: 12, fontWeight: '700', color: '#9E9E9E', marginBottom: 12, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: '#424242' },
  value: { fontSize: 14, color: '#424242' },
  bold: { fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 }
});

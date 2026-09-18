/**
 * Member 4 — Screens
 * mobile/src/screens/ProfitLoss/index.tsx
 *
 * P&L report for a date range.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { getProfitLoss, ProfitLossReport } from '../../db/views/profitLoss';

export default function ProfitLossScreen() {
  const business = useAppStore((s) => s.business);
  const [report, setReport] = useState<ProfitLossReport | null>(null);

  useEffect(() => {
    if (!business) return;
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 8) + '01'; // simple current month

    getProfitLoss(business.id, startOfMonth, today).then(setReport).catch(console.error);
  }, [business]);

  if (!report) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>📉 Profit & Loss</Text>
        <Text style={styles.period}>{report.periodFrom} to {report.periodTo}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionHead}>Income</Text>
          <Row label="Gross Sales" value={report.grossSales} />
          <Row label="Total Discount" value={-report.totalDiscount} />
          <View style={styles.divider} />
          <Row label="Net Sales" value={report.netSales} bold />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHead}>Expenses</Text>
          {report.expenseBreakdown.map((e, i) => (
            <Row key={i} label={e.category} value={e.amount} />
          ))}
          <View style={styles.divider} />
          <Row label="Total Expenses" value={report.totalExpenses} bold />
        </View>

        <View style={[styles.card, { backgroundColor: report.isProfit ? '#E8F5E9' : '#FFEBEE' }]}>
          <Row 
            label="NET PROFIT" 
            value={report.netProfit} 
            bold 
            color={report.isProfit ? '#2E7D32' : '#B71C1C'} 
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

/**
 * Dashboard — Member 4 scope: analytics summary view over the current
 * business's invoices for a period (defaults to this month).
 *
 * TODO (integration):
 *  - Replace useDb()/useBusinessId() with Member 1's real hooks/context.
 *  - Replace useTranslation() with whatever i18n library is wired up
 *    (e.g. i18next) — this assumes a `t('dashboard.totalSales')` shape.
 *  - Offline indicator should read Member 1's netListener.ts state.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
// import { useDb, useBusinessId } from '../../db'; // TODO: wire to Member 1's context
// import { useIsOffline } from '../../sync/netListener'; // TODO: wire to Member 1's sync layer

interface DashboardSummary {
  totalSales: number;
  totalInvoices: number;
  taxableAmount: number;
  totalGst: number;
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: replace with real local query, e.g.:
    // const db = useDb(); const businessId = useBusinessId();
    // getDashboardSummary(db, businessId, startOfMonth, today).then(setSummary);
    setLoading(false);
  }, []);

  if (loading) return <ActivityIndicator style={styles.center} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('dashboard.title')}</Text>
      <SummaryCard label={t('dashboard.totalSales')} value={summary?.totalSales ?? 0} />
      <SummaryCard label={t('dashboard.totalInvoices')} value={summary?.totalInvoices ?? 0} />
      <SummaryCard label={t('dashboard.taxableAmount')} value={summary?.taxableAmount ?? 0} />
      <SummaryCard label={t('dashboard.totalGst')} value={summary?.totalGst ?? 0} />
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#f2f4f8', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardLabel: { fontSize: 13, color: '#555' },
  cardValue: { fontSize: 24, fontWeight: '700', marginTop: 4 },
});

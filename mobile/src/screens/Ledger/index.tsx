/**
 * Member 4 — Screens
 * mobile/src/screens/Ledger/index.tsx
 *
 * Customer ledger view showing running balance.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getCustomerLedger, LedgerRow } from '../../db/views/customerBalances';
import { useAppStore } from '../../store/useAppStore';

export default function LedgerScreen() {
  const { customerId } = useLocalSearchParams();
  const business = useAppStore((s) => s.business);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  useEffect(() => {
    if (!business || !customerId) return;
    getCustomerLedger(business.id, customerId as string).then(setRows).catch(console.error);
  }, [business, customerId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>📓 Ledger</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 2 }]}>Date/Desc</Text>
        <Text style={styles.th}>Dr</Text>
        <Text style={styles.th}>Cr</Text>
        <Text style={styles.th}>Bal</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Text style={styles.date}>{item.entryDate}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
            <Text style={styles.td}>{item.debit > 0 ? item.debit : '-'}</Text>
            <Text style={styles.td}>{item.credit > 0 ? item.credit : '-'}</Text>
            <Text style={[styles.td, { fontWeight: '700' }]}>{item.runningBalance}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const GREEN = '#1B5E20';
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FBE7' },
  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: '900', color: GREEN },
  tableHeader: { flexDirection: 'row', backgroundColor: '#E8F5E9', padding: 12 },
  th: { flex: 1, fontWeight: '700', fontSize: 12, color: GREEN, textAlign: 'right' },
  row: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  td: { flex: 1, fontSize: 13, textAlign: 'right', marginTop: 4 },
  date: { fontSize: 11, color: '#757575' },
  desc: { fontSize: 13, fontWeight: '600' }
});

/**
 * Ledger (பேரேடு) — per-customer statement using getCustomerStatement()
 * from db/views/customerBalances.ts.
 * TODO (integration): accept customerId via navigation params; wire db/businessId context.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LedgerEntry } from '../../db/views/customerBalances';

export default function LedgerScreen() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    // TODO: const db = useDb(); const { customerId } = route.params;
    // getCustomerStatement(db, businessId, customerId).then(setEntries);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('ledger.title')}</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>{t('ledger.noEntries')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.entryDate}</Text>
            <Text>{item.description ?? '—'}</Text>
            <Text>{item.debit ? `-${item.debit}` : `+${item.credit}`}</Text>
            <Text style={styles.balance}>{item.runningBalance}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  empty: { color: '#888', textAlign: 'center', marginTop: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  balance: { fontWeight: '700' },
});

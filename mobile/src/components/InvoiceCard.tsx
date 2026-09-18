/**
 * Member 3 — Shared Components
 * mobile/src/components/InvoiceCard.tsx
 *
 * Reusable invoice summary card for InvoicesList screen.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Invoice, Customer } from '../db/schema';

interface Props {
  invoice:  Invoice;
  customer: Customer | null;
  onPress:  (invoiceId: string) => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid:    { bg: '#E8F5E9', text: '#2E7D32' },
  partial: { bg: '#FFF3E0', text: '#E65100' },
  unpaid:  { bg: '#FFEBEE', text: '#B71C1C' },
};

export function InvoiceCard({ invoice, customer, onPress }: Props) {
  const status = STATUS_COLORS[invoice.paymentStatus] ?? STATUS_COLORS.unpaid;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(invoice.id)}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.invoiceNo}>{invoice.invoiceNumber}</Text>
          <Text style={styles.customer}>{customer?.name ?? 'Walk-in Customer'}</Text>
          <Text style={styles.date}>{invoice.invoiceDate}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.amount}>₹{invoice.grandTotal.toFixed(2)}</Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>
              {invoice.paymentStatus.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
  invoiceNo: { fontWeight: '700', fontSize: 14, color: '#1B5E20' },
  customer:  { fontSize: 13, color: '#424242', marginTop: 2 },
  date:      { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  amount:    { fontWeight: '800', fontSize: 16, color: '#1A237E' },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

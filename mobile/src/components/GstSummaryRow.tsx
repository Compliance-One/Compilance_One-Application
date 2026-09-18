/**
 * Member 3 — Shared Components
 * mobile/src/components/GstSummaryRow.tsx
 *
 * Displays the GST breakdown row at the bottom of invoice preview.
 * Automatically shows CGST+SGST (intra-state) or IGST (inter-state).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  taxableAmount: number;
  cgst:          number;
  sgst:          number;
  igst:          number;
  grandTotal:    number;
  discount?:     number;
}

export function GstSummaryRow({
  taxableAmount,
  cgst,
  sgst,
  igst,
  grandTotal,
  discount = 0,
}: Props) {
  const isInterState = igst > 0;

  return (
    <View style={styles.container}>
      {discount > 0 && (
        <Row label="Discount" value={`-₹${discount.toFixed(2)}`} />
      )}
      <Row label="Taxable Amount" value={`₹${taxableAmount.toFixed(2)}`} />
      {isInterState ? (
        <Row label="IGST" value={`₹${igst.toFixed(2)}`} />
      ) : (
        <>
          <Row label="CGST" value={`₹${cgst.toFixed(2)}`} />
          <Row label="SGST" value={`₹${sgst.toFixed(2)}`} />
        </>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Grand Total</Text>
        <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: { fontSize: 13, color: '#555' },
  value: { fontSize: 13, color: '#222', fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#A5D6A7',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#1B5E20' },
  totalValue: { fontSize: 15, fontWeight: '800', color: '#1B5E20' },
});

/**
 * Reports Screen — matches GST Voice Billing UI design
 * Date range picker, Sales Summary stat cards (green), GST breakdown
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

export default function ReportsScreen() {
  const router   = useRouter();
  const business = useAppStore((s) => s.business);

  const [fromDate] = useState('01 Jul 2025');
  const [toDate]   = useState('22 Jul 2025');

  // Demo Stats
  const stats = {
    totalSales:    125430,
    totalInvoices: 156,
    taxableAmount: 118600,
    totalGst:       6830,
    cgst:           3415,
    sgst:           3415,
    igst:              0,
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>அறிக்கைகள் (Reports)</Text>
        <TouchableOpacity style={styles.calBtn}>
          <Text style={styles.calIcon}>📅</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Range */}
        <View style={styles.dateRangeCard}>
          <Text style={styles.dateRangeText}>
            {fromDate} — {toDate}
          </Text>
          <Text style={styles.dateRangeSub}>Tap 📅 to change date range</Text>
        </View>

        {/* Big Stats Cards */}
        <View style={styles.bigStatsRow}>
          <View style={[styles.bigStatCard, styles.bigStatGreen]}>
            <Text style={styles.bigStatTitle}>மொத்த விற்பனை{'\n'}(Total Sales)</Text>
            <Text style={styles.bigStatValue}>₹{stats.totalSales.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[styles.bigStatCard, styles.bigStatBlue]}>
            <Text style={styles.bigStatTitle}>மொத்த பில்கள்{'\n'}(Total Invoices)</Text>
            <Text style={[styles.bigStatValue, { color: '#1565C0' }]}>{stats.totalInvoices}</Text>
          </View>
        </View>

        <View style={styles.bigStatsRow}>
          <View style={[styles.bigStatCard, styles.bigStatOrange]}>
            <Text style={[styles.bigStatTitle, { color: '#E65100' }]}>Taxable Amount</Text>
            <Text style={[styles.bigStatValue, { color: '#E65100' }]}>₹{stats.taxableAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[styles.bigStatCard, styles.bigStatRed]}>
            <Text style={[styles.bigStatTitle, { color: '#B71C1C' }]}>மொத்த GST{'\n'}(Total GST)</Text>
            <Text style={[styles.bigStatValue, { color: '#C62828' }]}>₹{stats.totalGst.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* GST Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>GST Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>CGST</Text>
            <Text style={styles.summaryValue}>₹{stats.cgst.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>SGST</Text>
            <Text style={styles.summaryValue}>₹{stats.sgst.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>IGST</Text>
            <Text style={styles.summaryValue}>₹{stats.igst.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: '800', color: '#212121' }]}>Total GST</Text>
            <Text style={[styles.summaryValue, { fontWeight: '900', color: G_DARK }]}>₹{stats.totalGst.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/profit-loss' as any)}
          >
            <Text style={styles.quickLinkIcon}>📊</Text>
            <Text style={styles.quickLinkText}>Profit & Loss</Text>
            <Text style={styles.quickLinkArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/balance-sheet' as any)}
          >
            <Text style={styles.quickLinkIcon}>🏦</Text>
            <Text style={styles.quickLinkText}>Balance Sheet</Text>
            <Text style={styles.quickLinkArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.quickLinkDivider} />
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/gstr1-export' as any)}
          >
            <Text style={styles.quickLinkIcon}>🏛️</Text>
            <Text style={styles.quickLinkText}>GSTR-1 Export</Text>
            <Text style={styles.quickLinkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F0F4F0' },
  topBar:       { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 28, color: G_DARK, lineHeight: 30 },
  topTitle:     { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: G_DARK },
  calBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calIcon:      { fontSize: 20 },
  scroll:       { flex: 1 },
  content:      { padding: 16 },
  dateRangeCard:{ backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' },
  dateRangeText:{ fontSize: 15, fontWeight: '700', color: G_DARK },
  dateRangeSub: { fontSize: 12, color: '#66BB6A', marginTop: 2 },
  bigStatsRow:  { flexDirection: 'row', gap: 12, marginBottom: 12 },
  bigStatCard:  { flex: 1, borderRadius: 14, padding: 16, minHeight: 90 },
  bigStatGreen: { backgroundColor: '#E8F5E9' },
  bigStatBlue:  { backgroundColor: '#E3F2FD' },
  bigStatOrange:{ backgroundColor: '#FFF3E0' },
  bigStatRed:   { backgroundColor: '#FFEBEE' },
  bigStatTitle: { fontSize: 12, fontWeight: '700', color: G_DARK, lineHeight: 18 },
  bigStatValue: { fontSize: 20, fontWeight: '900', color: G_DARK, marginTop: 8 },
  summaryCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, marginBottom: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: '#212121', marginBottom: 14 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: '#616161', fontWeight: '600' },
  summaryValue: { fontSize: 15, color: '#212121', fontWeight: '700' },
  summaryDivider:{ height: 1, backgroundColor: '#F5F5F5' },
  quickLinks:   { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  quickLink:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  quickLinkIcon:{ fontSize: 20 },
  quickLinkText:{ flex: 1, fontSize: 15, fontWeight: '600', color: '#212121' },
  quickLinkArrow:{ fontSize: 22, color: '#BDBDBD' },
  quickLinkDivider:{ height: 1, backgroundColor: '#F5F5F5', marginLeft: 56 },
});

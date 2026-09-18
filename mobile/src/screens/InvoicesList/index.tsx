/**
 * InvoicesList Screen — Premium redesign
 * Dark green header · Search · Filter chips · Premium invoice cards with gradient accents
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, TextInput, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/client';
import { invoices } from '../../db/schema';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

type Period = 'all' | 'today' | 'week' | 'month';

const FILTERS: { key: Period; label: string; emoji: string }[] = [
  { key: 'all',   label: 'All',        emoji: '📋' },
  { key: 'today', label: 'Today',      emoji: '📅' },
  { key: 'week',  label: 'This Week',  emoji: '🗓️' },
  { key: 'month', label: 'This Month', emoji: '📆' },
];

const DEMO = [
  { id: 'inv-101', invoiceNumber: 'INV-2025-0722-001', invoiceDate: '22 Jul 2025', customerName: 'Walk-In Customer',   grandTotal: 4095, paymentStatus: 'paid'   },
  { id: 'inv-102', invoiceNumber: 'INV-2025-0722-002', invoiceDate: '22 Jul 2025', customerName: 'Ramesh Traders',     grandTotal: 2360, paymentStatus: 'paid'   },
  { id: 'inv-103', invoiceNumber: 'INV-2025-0721-015', invoiceDate: '21 Jul 2025', customerName: 'Sakthi Enterprises', grandTotal: 1575, paymentStatus: 'unpaid' },
  { id: 'inv-104', invoiceNumber: 'INV-2025-0721-014', invoiceDate: '21 Jul 2025', customerName: 'Walk-In Customer',   grandTotal:  870, paymentStatus: 'paid'   },
  { id: 'inv-105', invoiceNumber: 'INV-2025-0720-010', invoiceDate: '20 Jul 2025', customerName: 'Kumar Stores',       grandTotal: 3100, paymentStatus: 'paid'   },
  { id: 'inv-106', invoiceNumber: 'INV-2025-0720-009', invoiceDate: '20 Jul 2025', customerName: 'Murugan Traders',    grandTotal: 6800, paymentStatus: 'unpaid' },
];

export default function InvoicesListScreen() {
  const router   = useRouter();
  const business = useAppStore((s) => s.business);

  const [items,      setItems]      = useState(DEMO);
  const [search,     setSearch]     = useState('');
  const [period,     setPeriod]     = useState<Period>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const list = await db.select().from(invoices).then((r: any[]) => r);
      if (list?.length > 0) {
        setItems(list.map((inv: any) => ({
          id: inv.id, invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate?.slice(0, 10) ?? '',
          customerName: 'Customer', grandTotal: inv.grandTotal ?? 0,
          paymentStatus: inv.paymentStatus ?? 'unpaid',
        })));
      }
    } catch {}
  }, [business]);

  useEffect(() => { loadInvoices(); }, []);

  const filtered = items.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q);
  });

  const totalPaid   = filtered.filter(i => i.paymentStatus === 'paid').length;
  const totalUnpaid = filtered.filter(i => i.paymentStatus === 'unpaid').length;
  const totalValue  = filtered.reduce((s, i) => s + i.grandTotal, 0);

  const renderItem = ({ item }: { item: typeof DEMO[0] }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.82}>
      <View style={[styles.cardAccent, item.paymentStatus === 'paid' ? styles.accentPaid : styles.accentUnpaid]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardNumber}>{item.invoiceNumber}</Text>
            <Text style={styles.cardDate}>📅 {item.invoiceDate}</Text>
          </View>
          <View style={[styles.statusBadge, item.paymentStatus === 'paid' ? styles.badgePaid : styles.badgeUnpaid]}>
            <Text style={[styles.statusText, item.paymentStatus === 'paid' ? styles.textPaid : styles.textUnpaid]}>
              {item.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Unpaid'}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>{item.customerName[0]}</Text>
            </View>
            <Text style={styles.cardCustomer}>{item.customerName}</Text>
          </View>
          <Text style={styles.cardAmount}>₹{item.grandTotal.toLocaleString('en-IN')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>Invoices</Text>
          <Text style={styles.topSub}>{filtered.length} total · ₹{totalValue.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/invoice-create' as any)}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Summary pills */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryPill, styles.pillPaid]}>
          <Text style={[styles.pillText, styles.pillTextPaid]}>✓ Paid: {totalPaid}</Text>
        </View>
        <View style={[styles.summaryPill, styles.pillUnpaid]}>
          <Text style={[styles.pillText, styles.pillTextUnpaid]}>⏳ Unpaid: {totalUnpaid}</Text>
        </View>
        <View style={[styles.summaryPill, styles.pillTotal]}>
          <Text style={[styles.pillText, styles.pillTextTotal]}>₹{totalValue.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchEmoji}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by invoice # or customer..."
          placeholderTextColor="#BDBDBD"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Period Filter */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, period === f.key && styles.filterBtnActive]}
            onPress={() => setPeriod(f.key)}
          >
            <Text style={[styles.filterText, period === f.key && styles.filterTextActive]}>
              {f.emoji} {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadInvoices(); setRefreshing(false); }}
            colors={[G_MED]}
            tintColor={G_MED}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No invoices found</Text>
            <Text style={styles.emptyText}>Try a different filter or create a new invoice</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F4F7F4' },
  topBar:       { backgroundColor: G_DARK, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, paddingTop: 20 },
  topTitle:     { fontSize: 20, fontWeight: '900', color: '#fff' },
  topSub:       { fontSize: 12, color: '#A5D6A7', marginTop: 2 },
  addBtn:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:   { fontSize: 14, fontWeight: '800', color: '#fff' },
  summaryRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: G_DARK, paddingBottom: 16 },
  summaryPill:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillPaid:     { backgroundColor: 'rgba(76,175,80,0.3)' },
  pillUnpaid:   { backgroundColor: 'rgba(255,152,0,0.3)' },
  pillTotal:    { backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 'auto' },
  pillText:     { fontSize: 12, fontWeight: '700' },
  pillTextPaid: { color: '#A5D6A7' },
  pillTextUnpaid:{ color: '#FFB74D' },
  pillTextTotal:{ color: '#fff' },
  searchWrap:   { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: -8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  searchEmoji:  { fontSize: 16, marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 15, color: '#212121' },
  clearBtn:     { fontSize: 16, color: '#BDBDBD', padding: 4 },
  filterRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 6, marginBottom: 4 },
  filterBtn:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8E8E8' },
  filterBtnActive:{ backgroundColor: G_DARK, borderColor: G_DARK },
  filterText:   { fontSize: 12, fontWeight: '700', color: '#757575' },
  filterTextActive:{ color: '#fff' },
  list:         { padding: 16, paddingTop: 8, paddingBottom: 100 },
  card:         { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, flexDirection: 'row', overflow: 'hidden' },
  cardAccent:   { width: 5 },
  accentPaid:   { backgroundColor: G_MED },
  accentUnpaid: { backgroundColor: '#FB8C00' },
  cardBody:     { flex: 1, padding: 14 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardNumber:   { fontSize: 14, fontWeight: '800', color: G_DARK },
  cardDate:     { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  statusBadge:  { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgePaid:    { backgroundColor: '#E8F5E9' },
  badgeUnpaid:  { backgroundColor: '#FFF3E0' },
  statusText:   { fontSize: 12, fontWeight: '800' },
  textPaid:     { color: G_MED },
  textUnpaid:   { color: '#E65100' },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customerAvatar:{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  customerAvatarText:{ fontSize: 12, fontWeight: '800', color: G_DARK },
  cardCustomer: { fontSize: 13, color: '#616161', fontWeight: '600' },
  cardAmount:   { fontSize: 18, fontWeight: '900', color: '#212121' },
  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: '#424242', marginBottom: 6 },
  emptyText:    { fontSize: 14, color: '#9E9E9E', textAlign: 'center' },
});

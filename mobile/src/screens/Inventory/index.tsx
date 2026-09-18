/**
 * Inventory Screen — Premium Redesign
 * - Dark green header with back navigation & Tamil title
 * - Product stock cards with status badges (In Stock / Low Stock)
 * - Total stock items & valuation overview
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/client';
import { products } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { Product } from '../../db/schema';

const G_DARK = '#1B5E20';

export default function InventoryScreen() {
  const router   = useRouter();
  const business = useAppStore((s) => s.business);
  const [items, setItems] = useState<Product[]>([]);

  const loadInventory = useCallback(async () => {
    if (!business) return;
    try {
      const list = await db.select().from(products).where(eq(products.businessId, business.id));
      setItems(list);
    } catch (e) {
      console.log('Inventory load:', e);
    }
  }, [business]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const totalStockCount = items.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
  const totalValuation  = items.reduce((acc, p) => acc + (p.stockQuantity || 0) * (p.price || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>சரக்கு இருப்பு</Text>
          <Text style={styles.headerSub}>Stock & Inventory ({items.length} பொருட்கள்)</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/products')}>
          <Text style={styles.actionBtnText}>+ பொருள்</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>மொத்த இருப்பு (Items)</Text>
          <Text style={styles.metricValue}>{totalStockCount} அலகுகள்</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>சரக்கு மதிப்பு (Valuation)</Text>
          <Text style={[styles.metricValue, { color: G_DARK }]}>₹{totalValuation.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>சரக்கு விவரங்கள் இல்லை</Text>
            <Text style={styles.emptySub}>பொருட்கள் பக்கத்தில் சென்று பொருட்களை சேர்க்கவும்</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLow = item.stockQuantity <= 10;
          return (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>
                  HSN: {item.hsnCode} • விலை: ₹{item.price}/{item.unit} • GST: {item.gstRate}%
                </Text>
              </View>

              <View style={styles.cardRight}>
                <View style={[styles.stockBadge, isLow ? styles.stockLowBadge : styles.stockNormalBadge]}>
                  <Text style={[styles.stockBadgeText, isLow ? styles.stockLowText : styles.stockNormalText]}>
                    {item.stockQuantity} {item.unit}
                  </Text>
                </View>
                <Text style={styles.stockSubLabel}>{isLow ? '⚠️ குறைவு' : '✅ போதிய இருப்பு'}</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#F4F7F4' },
  header:             { backgroundColor: G_DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backArrow:          { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '700' },
  headerTitles:       { flex: 1 },
  headerTitle:        { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:          { color: '#A5D6A7', fontSize: 11, fontWeight: '600' },
  actionBtn:          { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  actionBtnText:      { color: '#fff', fontWeight: '800', fontSize: 12 },
  metricsRow:         { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  metricCard:         { flex: 1, backgroundColor: '#F9FAF9', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  metricLabel:        { fontSize: 11, color: '#616161', fontWeight: '600' },
  metricValue:        { fontSize: 15, fontWeight: '800', color: '#212121', marginTop: 4 },
  list:               { padding: 14, paddingBottom: 60 },
  card:               { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3 },
  cardLeft:           { flex: 1, marginRight: 10 },
  productName:        { fontSize: 14, fontWeight: '800', color: '#212121' },
  productMeta:        { fontSize: 11, color: '#757575', marginTop: 3 },
  cardRight:          { alignItems: 'flex-end' },
  stockBadge:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stockNormalBadge:   { backgroundColor: '#E8F5E9' },
  stockLowBadge:      { backgroundColor: '#FFEBEE' },
  stockBadgeText:     { fontSize: 13, fontWeight: '800' },
  stockNormalText:    { color: G_DARK },
  stockLowText:       { color: '#C62828' },
  stockSubLabel:      { fontSize: 10, color: '#757575', marginTop: 3 },
  emptyWrap:          { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:          { fontSize: 40, marginBottom: 8 },
  emptyTitle:         { fontSize: 16, fontWeight: '800', color: '#424242' },
  emptySub:           { fontSize: 12, color: '#757575', marginTop: 4, textAlign: 'center' },
});

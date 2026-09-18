/**
 * Products Screen — matches GST Voice Billing UI design
 * Search + Add button, product cards with HSN, GST%, price
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView,
  TextInput, Modal, Alert, ScrollView,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/client';
import { products } from '../../db/schema';
import { eq } from 'drizzle-orm';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

const GST_RATES = ['0', '5', '12', '18', '28'];
const UNITS     = ['KG', 'PCS', 'LTR', 'PKT', 'BOX', 'NOS'];

interface Product {
  id: string; businessId: string; name: string; hsnCode: string;
  gstRate: number; unit: string; price: number; stockQuantity: number;
  isActive: number | boolean; createdAt: string; updatedAt: string;
}

export default function ProductsScreen() {
  const router   = useRouter();
  const business = useAppStore((s) => s.business);

  const [items,        setItems]        = useState<Product[]>([]);
  const [search,       setSearch]       = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing,      setEditing]      = useState<Product | null>(null);

  // Form
  const [name,     setName]     = useState('');
  const [hsnCode,  setHsnCode]  = useState('');
  const [gstRate,  setGstRate]  = useState('5');
  const [price,    setPrice]    = useState('');
  const [unit,     setUnit]     = useState('KG');
  const [stock,    setStock]    = useState('0');

  const loadProducts = useCallback(async () => {
    try {
      const list = await db.select().from(products).then((r: any[]) => r);
      setItems(list ?? []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const openAdd = () => {
    setEditing(null);
    setName(''); setHsnCode(''); setGstRate('5'); setPrice(''); setUnit('KG'); setStock('0');
    setModalVisible(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name); setHsnCode(p.hsnCode); setGstRate(String(p.gstRate));
    setPrice(String(p.price)); setUnit(p.unit); setStock(String(p.stockQuantity));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !hsnCode.trim() || !price.trim()) {
      Alert.alert('Error', 'Name, HSN Code and Price are required');
      return;
    }
    const payload = {
      id: editing?.id ?? uuidv4(),
      businessId: business?.id ?? 'demo-biz',
      name: name.trim(),
      hsnCode: hsnCode.trim(),
      gstRate: parseFloat(gstRate),
      unit,
      price: parseFloat(price),
      stockQuantity: parseFloat(stock || '0'),
      isActive: true,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editing) {
        await db.update(products).set(payload).where(eq(products.id, editing.id));
      } else {
        await db.insert(products).values(payload);
      }
      await loadProducts();
    } catch {
      setItems(prev => editing
        ? prev.map(p => p.id === editing.id ? { ...p, ...payload } : p)
        : [...prev, payload as Product]
      );
    }
    setModalVisible(false);
  };

  const filtered = search
    ? items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.hsnCode.includes(search))
    : items;

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        <View style={styles.cardIconWrap}>
          <Text style={styles.cardIcon}>📦</Text>
        </View>
        <View>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardHsn}>HSN {item.hsnCode} · GST {item.gstRate}%</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardPrice}>₹{item.price}</Text>
        <TouchableOpacity style={styles.editDot}>
          <Text style={styles.editDotText}>⋮</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>பொருட்கள் (Products)</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.searchIconBtn}>
            <Text>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addIconBtn} onPress={openAdd}>
            <Text style={styles.addIconText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchEmoji}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#BDBDBD"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No products yet. Tap + to add.</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'Add Product'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.formLabel}>Product Name *</Text>
            <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="e.g. அரிசி 1kg" />

            <Text style={styles.formLabel}>HSN Code *</Text>
            <TextInput style={styles.formInput} value={hsnCode} onChangeText={setHsnCode} placeholder="e.g. 1006" />

            <Text style={styles.formLabel}>GST Rate %</Text>
            <View style={styles.gstRow}>
              {GST_RATES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.gstBtn, gstRate === r && styles.gstBtnActive]}
                  onPress={() => setGstRate(r)}
                >
                  <Text style={[styles.gstBtnText, gstRate === r && styles.gstBtnTextActive]}>{r}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Price (₹) *</Text>
            <TextInput style={styles.formInput} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 120" />

            <Text style={styles.formLabel}>Unit</Text>
            <View style={styles.unitRow}>
              {UNITS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Stock Quantity</Text>
            <TextInput style={styles.formInput} value={stock} onChangeText={setStock} keyboardType="numeric" placeholder="0" />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F0F4F0' },
  topBar:       { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 28, color: G_DARK, lineHeight: 30 },
  topTitle:     { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: G_DARK },
  headerRight:  { flexDirection: 'row', gap: 6 },
  searchIconBtn:{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addIconBtn:   { width: 32, height: 32, borderRadius: 8, backgroundColor: G_DARK, alignItems: 'center', justifyContent: 'center' },
  addIconText:  { fontSize: 22, color: '#fff', lineHeight: 28 },
  searchWrap:   { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, marginBottom: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  searchEmoji:  { fontSize: 16, marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 15, color: '#212121' },
  list:         { padding: 16, paddingTop: 8, paddingBottom: 40 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardIcon:     { fontSize: 20 },
  cardName:     { fontSize: 15, fontWeight: '700', color: '#212121' },
  cardHsn:      { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  cardRight:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardPrice:    { fontSize: 16, fontWeight: '800', color: G_DARK },
  editDot:      { padding: 4 },
  editDotText:  { fontSize: 20, color: '#BDBDBD' },
  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 16, color: '#9E9E9E' },
  // Modal
  modalSafe:    { flex: 1, backgroundColor: '#fff' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalCancel:  { fontSize: 16, color: '#9E9E9E' },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: G_DARK },
  modalSave:    { fontSize: 16, fontWeight: '800', color: G_MED },
  modalBody:    { padding: 16 },
  formLabel:    { fontSize: 13, fontWeight: '700', color: '#757575', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.3 },
  formInput:    { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#E0E0E0' },
  gstRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  gstBtn:       { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  gstBtnActive: { backgroundColor: G_DARK, borderColor: G_DARK },
  gstBtnText:   { fontSize: 14, fontWeight: '700', color: '#616161' },
  gstBtnTextActive: { color: '#fff' },
  unitRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  unitBtn:      { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  unitBtnActive:{ backgroundColor: G_DARK, borderColor: G_DARK },
  unitBtnText:  { fontSize: 13, fontWeight: '700', color: '#616161' },
  unitBtnTextActive: { color: '#fff' },
});

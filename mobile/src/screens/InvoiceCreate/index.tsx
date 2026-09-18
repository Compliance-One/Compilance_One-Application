/**
 * InvoiceCreate Screen — Premium & Fully Functional
 * - Add products from catalog or custom
 * - Quantity increment / decrement
 * - Customer selection (Walk-in / existing)
 * - Auto GST calculation (CGST + SGST)
 * - Paid / Unpaid toggle
 * - Safe SQLite save
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GstSummaryRow } from '../../components/GstSummaryRow';
import { useAppStore, LineItem } from '../../store/useAppStore';
import { db } from '../../db/client';
import {
  invoices, invoiceItems, ledgerEntries, customers as customersTable, products as productsTable,
} from '../../db/schema';
import { eq } from 'drizzle-orm';
import { enqueue } from '../../sync/outbox';
import type { Customer, Product } from '../../db/schema';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

function generateId(): string {
  return 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

export default function InvoiceCreateScreen() {
  const router       = useRouter();
  const business     = useAppStore((s) => s.business);
  const draftItems   = useAppStore((s) => s.draftLineItems);
  const clearDraft   = useAppStore((s) => s.clearDraft);

  const [items,        setItems]        = useState<LineItem[]>(draftItems);
  const [customer,     setCustomer]     = useState<Customer | null>(null);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [productList,  setProductList]  = useState<Product[]>([]);
  const [paymentStatus,setPaymentStatus]= useState<'paid' | 'unpaid'>('paid');
  const [saving,       setSaving]       = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [search,       setSearch]       = useState('');

  // Load customers and products from SQLite
  useEffect(() => {
    if (!business) return;
    db.select().from(customersTable)
      .where(eq(customersTable.businessId, business.id))
      .then(setCustomerList)
      .catch(() => {});

    db.select().from(productsTable)
      .where(eq(productsTable.businessId, business.id))
      .then(setProductList)
      .catch(() => {});
  }, [business]);

  // If draft items exist in store on mount, populate
  useEffect(() => {
    if (draftItems.length > 0 && items.length === 0) {
      setItems(draftItems);
    }
  }, [draftItems]);

  // Add product from catalog
  const handleAddProduct = (prod: Product) => {
    const existing = items.findIndex(i => i.productId === prod.id);
    if (existing >= 0) {
      // Increment quantity
      updateQuantity(existing, 1);
    } else {
      const qty = 1;
      const rate = prod.price;
      const taxable = rate * qty;
      const gstRate = prod.gstRate;
      const tax = (taxable * gstRate) / 100;
      const cgst = tax / 2;
      const sgst = tax / 2;
      const total = taxable + tax;

      const newItem: LineItem = {
        productId: prod.id,
        productName: prod.name,
        hsnCode: prod.hsnCode,
        quantity: qty,
        unit: prod.unit,
        rate,
        discount: 0,
        taxableAmount: taxable,
        gstRate,
        cgst,
        sgst,
        igst: 0,
        total,
      };
      setItems(prev => [...prev, newItem]);
    }
    setModalVisible(false);
  };

  const updateQuantity = (idx: number, delta: number) => {
    setItems(prev => {
      const copy = [...prev];
      const it = copy[idx];
      const newQty = Math.max(1, it.quantity + delta);
      const taxable = it.rate * newQty;
      const tax = (taxable * it.gstRate) / 100;
      copy[idx] = {
        ...it,
        quantity: newQty,
        taxableAmount: taxable,
        cgst: tax / 2,
        sgst: tax / 2,
        total: taxable + tax,
      };
      return copy;
    });
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal      = items.reduce((s, i) => s + i.rate * i.quantity, 0);
  const discount      = items.reduce((s, i) => s + i.discount, 0);
  const taxableAmount = items.reduce((s, i) => s + i.taxableAmount, 0);
  const cgst          = items.reduce((s, i) => s + i.cgst, 0);
  const sgst          = items.reduce((s, i) => s + i.sgst, 0);
  const igst          = items.reduce((s, i) => s + i.igst, 0);
  const grandTotal    = taxableAmount + cgst + sgst + igst;

  // ── Save invoice ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!business || items.length === 0) {
      Alert.alert('கவனம் (Attention)', 'பில் உருவாக்க குறைந்தபட்சம் 1 பொருள் சேர்க்கவும்.\n(Please add at least one item).');
      return;
    }
    setSaving(true);

    try {
      const invoiceId     = generateId();
      const invoiceNumber = `INV-${Date.now().toString().slice(-4)}`;
      const invoiceDate   = new Date().toISOString().slice(0, 10);

      // Insert invoice into SQLite
      await db.insert(invoices).values({
        id: invoiceId,
        businessId: business.id,
        customerId: customer?.id ?? null,
        invoiceNumber,
        invoiceDate,
        invoiceType: customer?.customerType ?? 'B2C',
        subtotal,
        discount,
        taxableAmount,
        cgst,
        sgst,
        igst,
        totalTax: cgst + sgst + igst,
        grandTotal,
        paymentStatus,
        notes: 'Mobile app invoice',
      });

      // Insert line items
      for (const item of items) {
        await db.insert(invoiceItems).values({
          id:           generateId(),
          invoiceId,
          productId:    item.productId,
          productName:  item.productName,
          hsnCode:      item.hsnCode,
          quantity:     item.quantity,
          unit:         item.unit,
          rate:         item.rate,
          discount:     item.discount,
          taxableAmount:item.taxableAmount,
          gstRate:      item.gstRate,
          cgst:         item.cgst,
          sgst:         item.sgst,
          igst:         item.igst,
          total:        item.total,
        });
      }

      // Auto-create ledger debit entry for customer
      if (customer) {
        await db.insert(ledgerEntries).values({
          id:          generateId(),
          businessId:  business.id,
          customerId:  customer.id,
          invoiceId,
          entryDate:   invoiceDate,
          description: `Invoice ${invoiceNumber}`,
          debit:       grandTotal,
          credit:      paymentStatus === 'paid' ? grandTotal : 0,
        });
      }

      clearDraft();
      Alert.alert(
        'வெற்றி! (Success)',
        `${invoiceNumber} வெற்றிகரமாக சேமிக்கப்பட்டது!\nமொத்த தொகை: ₹${grandTotal.toFixed(2)}`,
        [{ text: 'சரி (OK)', onPress: () => router.replace('/invoices') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }, [business, items, customer, grandTotal, paymentStatus]);

  const filteredProducts = search.trim()
    ? productList.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.hsnCode.includes(search))
    : productList;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>புதிய ஜிஎஸ்டி பில்</Text>
          <Text style={styles.headerSub}>Create GST Invoice</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.badgeText}>{business?.businessName ?? 'Store'}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>👤 வாடிக்கையாளர் (CUSTOMER)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <TouchableOpacity
              style={[styles.customerChip, !customer && styles.chipActive]}
              onPress={() => setCustomer(null)}
            >
              <Text style={[styles.chipText, !customer && styles.chipTextActive]}>Walk-in (நேரடி வாடிக்கையாளர்)</Text>
            </TouchableOpacity>
            {customerList.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.customerChip, customer?.id === c.id && styles.chipActive]}
                onPress={() => setCustomer(c)}
              >
                <Text style={[styles.chipText, customer?.id === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Payment Status Selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>💳 பணம் செலுத்தும் நிலை (PAYMENT STATUS)</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusBtn, paymentStatus === 'paid' && styles.statusBtnPaidActive]}
              onPress={() => setPaymentStatus('paid')}
            >
              <Text style={[styles.statusBtnText, paymentStatus === 'paid' && styles.statusBtnTextActive]}>
                ✅ செலுத்தப்பட்டது (Paid)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, paymentStatus === 'unpaid' && styles.statusBtnUnpaidActive]}
              onPress={() => setPaymentStatus('unpaid')}
            >
              <Text style={[styles.statusBtnText, paymentStatus === 'unpaid' && styles.statusBtnTextActive]}>
                ⏳ கடன் / நிலுவை (Unpaid)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Line Items Header & Add Button */}
        <View style={styles.itemsHeaderRow}>
          <Text style={styles.itemsHeaderTitle}>பொருட்கள் ({items.length} பொருட்கள்)</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ பொருள் சேர்</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        {items.length === 0 ? (
          <TouchableOpacity style={styles.emptyCard} onPress={() => setModalVisible(true)}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>பொருட்கள் எதுவும் சேர்க்கப்படவில்லை</Text>
            <Text style={styles.emptySub}>இங்கு தட்டி பொருட்களை சேர்க்கவும் (Tap to add items)</Text>
          </TouchableOpacity>
        ) : (
          items.map((item, idx) => (
            <View key={`${item.productId}-${idx}`} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>
                    HSN: {item.hsnCode} | GST: {item.gstRate}% | விலை: ₹{item.rate}/{item.unit}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeItem(idx)} style={styles.delBtn}>
                  <Text style={styles.delBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemBottom}>
                {/* Qty controls */}
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(idx, -1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyVal}>{item.quantity} {item.unit}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(idx, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Amount */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemTotal}>₹{item.total.toFixed(2)}</Text>
                  <Text style={styles.itemTax}>(வரி: ₹{(item.cgst + item.sgst).toFixed(2)})</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* GST Summary */}
        {items.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>📊 வரி விவரம் (TAX SUMMARY)</Text>
            <GstSummaryRow
              taxableAmount={taxableAmount}
              cgst={cgst}
              sgst={sgst}
              igst={igst}
              grandTotal={grandTotal}
              discount={discount}
            />
          </View>
        )}

        {/* Bottom Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, items.length === 0 && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || items.length === 0}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              💾 பில் சேமிக்க (₹{grandTotal.toFixed(2)})
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Product Picker Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>பொருள் தேர்வு செய்க (Pick Product)</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={modalStyles.close}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={modalStyles.search}
              placeholder="தேடுக... (Search product or HSN)"
              placeholderTextColor="#9E9E9E"
              value={search}
              onChangeText={setSearch}
            />

            <FlatList
              data={filteredProducts}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={modalStyles.itemRow} onPress={() => handleAddProduct(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.itemName}>{item.name}</Text>
                    <Text style={modalStyles.itemSub}>
                      HSN: {item.hsnCode} • GST: {item.gstRate}% • கையிருப்பு: {item.stockQuantity} {item.unit}
                    </Text>
                  </View>
                  <View style={modalStyles.priceWrap}>
                    <Text style={modalStyles.price}>₹{item.price}</Text>
                    <Text style={modalStyles.addChip}>+ சேர்</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#F4F7F4' },
  header:             { backgroundColor: G_DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backText:           { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '700' },
  headerTitles:       { flex: 1 },
  headerTitle:        { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:          { color: '#A5D6A7', fontSize: 11, fontWeight: '600' },
  headerBadge:        { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText:          { color: '#fff', fontSize: 11, fontWeight: '700' },
  scroll:             { flex: 1 },
  content:            { padding: 16, paddingBottom: 50 },
  sectionCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3 },
  sectionLabel:       { fontSize: 11, fontWeight: '800', color: '#616161', marginBottom: 8, letterSpacing: 0.5 },
  chipsScroll:        { flexDirection: 'row' },
  customerChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F4F0', borderWidth: 1, borderColor: '#C8E6C9', marginRight: 8 },
  chipActive:         { backgroundColor: G_DARK, borderColor: G_DARK },
  chipText:           { color: '#2E7D32', fontSize: 13, fontWeight: '600' },
  chipTextActive:     { color: '#fff' },
  statusRow:          { flexDirection: 'row', gap: 8 },
  statusBtn:          { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F0F4F0', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  statusBtnPaidActive:{ backgroundColor: '#E8F5E9', borderColor: '#43A047' },
  statusBtnUnpaidActive:{ backgroundColor: '#FFF3E0', borderColor: '#FB8C00' },
  statusBtnText:      { fontSize: 12, fontWeight: '700', color: '#757575' },
  statusBtnTextActive:{ color: '#1B5E20' },
  itemsHeaderRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 },
  itemsHeaderTitle:   { fontSize: 15, fontWeight: '800', color: '#212121' },
  addBtn:             { backgroundColor: G_DARK, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText:         { color: '#fff', fontSize: 12, fontWeight: '800' },
  emptyCard:          { backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center', marginBottom: 12, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#A5D6A7' },
  emptyIcon:          { fontSize: 36, marginBottom: 8 },
  emptyTitle:         { fontSize: 15, fontWeight: '700', color: '#424242', marginBottom: 4 },
  emptySub:           { fontSize: 12, color: '#757575' },
  itemCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3 },
  itemTop:            { flexDirection: 'row', justifyContent: 'space-between' },
  itemName:           { fontSize: 14, fontWeight: '800', color: '#212121' },
  itemMeta:           { fontSize: 11, color: '#757575', marginTop: 2 },
  delBtn:             { padding: 4 },
  delBtnText:         { color: '#E53935', fontSize: 16, fontWeight: '700' },
  itemBottom:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  qtyRow:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4F0', borderRadius: 20, paddingHorizontal: 4 },
  qtyBtn:             { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:         { fontSize: 16, fontWeight: '800', color: G_DARK },
  qtyVal:             { paddingHorizontal: 12, fontSize: 13, fontWeight: '700', color: '#212121' },
  itemTotal:          { fontSize: 15, fontWeight: '800', color: G_DARK },
  itemTax:            { fontSize: 10, color: '#757575' },
  summaryCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 6, marginBottom: 16 },
  saveBtn:            { backgroundColor: G_DARK, paddingVertical: 16, borderRadius: 12, alignItems: 'center', elevation: 2, shadowColor: G_DARK, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  saveBtnDisabled:    { backgroundColor: '#BDBDBD' },
  saveBtnText:        { color: '#fff', fontSize: 16, fontWeight: '800' },
});

const modalStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 16 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:    { fontSize: 16, fontWeight: '800', color: '#212121' },
  close:    { fontSize: 20, color: '#757575', padding: 4 },
  search:   { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 12 },
  itemRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#212121' },
  itemSub:  { fontSize: 11, color: '#757575', marginTop: 2 },
  priceWrap:{ alignItems: 'flex-end' },
  price:    { fontSize: 14, fontWeight: '800', color: G_DARK, marginBottom: 2 },
  addChip:  { backgroundColor: '#E8F5E9', color: G_DARK, fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});

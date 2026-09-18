/**
 * Customers Screen — Premium Redesign
 * - Dark green header with back navigation & Tamil title
 * - Customer cards with initials avatar & balance pills
 * - Add Customer modal with safe ID generation
 * - Real-time search by name or phone
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, SafeAreaView, TextInput,
  Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/client';
import { customers as customersTable } from '../../db/schema';
import { getCustomerBalances, CustomerBalance } from '../../db/views/customerBalances';
import { eq } from 'drizzle-orm';
import { enqueue } from '../../sync/outbox';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

function generateId(): string {
  return 'cust_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

export default function CustomersScreen() {
  const router   = useRouter();
  const business = useAppStore((s) => s.business);

  const [items,          setItems]          = useState<CustomerBalance[]>([]);
  const [search,         setSearch]         = useState('');
  const [isModalVisible, setModalVisible]   = useState(false);

  // Form state
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [address, setAddress] = useState('');
  const [gstin,   setGstin]   = useState('');
  const [type,    setType]    = useState('B2C');

  const loadCustomers = useCallback(async () => {
    if (!business) return;
    try {
      let balances: CustomerBalance[] = [];
      try {
        balances = await getCustomerBalances(business.id);
      } catch {
        // Fallback: select raw customers from SQLite
        const raw = await db.select().from(customersTable).where(eq(customersTable.businessId, business.id));
        balances = raw.map(c => ({
          customerId: c.id,
          customerName: c.name,
          phone: c.phone,
          totalInvoiced: 0,
          totalPaid: 0,
          netBalance: 0,
        }));
      }

      if (search.trim()) {
        const lowerSearch = search.toLowerCase();
        setItems(balances.filter(c =>
          c.customerName.toLowerCase().includes(lowerSearch) ||
          (c.phone && c.phone.includes(search))
        ));
      } else {
        setItems(balances);
      }
    } catch (e) {
      console.log('Customer load notice:', e);
    }
  }, [business, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const handleOpenModal = () => {
    setName(''); setPhone(''); setAddress(''); setGstin(''); setType('B2C');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!business || !name.trim()) {
      Alert.alert('கவனம்', 'வாடிக்கையாளர் பெயர் அவசியம் (Name is required)');
      return;
    }

    const id = generateId();
    const payload = {
      id,
      businessId: business.id,
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
      customerType: gstin.trim() ? 'B2B' : type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await db.insert(customersTable).values(payload);
      try { await enqueue('customers', 'INSERT', id, payload); } catch {}
      setModalVisible(false);
      loadCustomers();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save customer');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>வாடிக்கையாளர்கள்</Text>
          <Text style={styles.headerSub}>Customers ({items.length})</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenModal}>
          <Text style={styles.addBtnText}>+ சேர்</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="வாடிக்கையாளர் பெயர் / எண் தேடுக..."
          placeholderTextColor="#9E9E9E"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(c) => c.customerId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>வாடிக்கையாளர்கள் இல்லை</Text>
            <Text style={styles.emptySub}>"+ சேர்" பொத்தானை அழுத்தி புதிய வாடிக்கையாளரை சேர்க்கவும்</Text>
          </View>
        }
        renderItem={({ item }) => {
          const initials = item.customerName.slice(0, 2).toUpperCase();
          const hasBalance = item.netBalance !== 0;
          return (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.info}>
                <Text style={styles.name}>{item.customerName}</Text>
                <Text style={styles.phone}>📞 {item.phone || 'எண் இல்லை'}</Text>
              </View>

              <View style={styles.balanceBox}>
                <Text style={styles.balanceLabel}>நிலுவை (Balance)</Text>
                <Text style={[styles.balanceValue, item.netBalance > 0 ? styles.balanceDue : styles.balanceClear]}>
                  {item.netBalance > 0 ? `₹${item.netBalance.toFixed(0)} கடன்` : 'முழுதும் முடிந்தது'}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>புதிய வாடிக்கையாளர் (Add Customer)</Text>
            
            <TextInput
              style={styles.input}
              placeholder="வாடிக்கையாளர் பெயர் * (Name)"
              placeholderTextColor="#9E9E9E"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="தொலைபேசி எண் (Phone)"
              placeholderTextColor="#9E9E9E"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="முகவரி (Address)"
              placeholderTextColor="#9E9E9E"
              value={address}
              onChangeText={setAddress}
            />
            <TextInput
              style={styles.input}
              placeholder="ஜிஎஸ்டி எண் (GSTIN - optional)"
              placeholderTextColor="#9E9E9E"
              value={gstin}
              onChangeText={setGstin}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>ரத்து (Cancel)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>சேமி (Save)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#F4F7F4' },
  header:           { backgroundColor: G_DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backArrow:        { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '700' },
  headerTitles:     { flex: 1 },
  headerTitle:      { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:        { color: '#A5D6A7', fontSize: 11, fontWeight: '600' },
  addBtn:           { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:       { color: '#fff', fontWeight: '800', fontSize: 13 },
  searchContainer:  { padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  searchInput:      { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 },
  list:             { padding: 14, paddingBottom: 60 },
  card:             { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3 },
  avatar:           { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:       { fontSize: 14, fontWeight: '800', color: G_DARK },
  info:             { flex: 1 },
  name:             { fontSize: 14, fontWeight: '800', color: '#212121' },
  phone:            { fontSize: 12, color: '#757575', marginTop: 2 },
  balanceBox:       { alignItems: 'flex-end' },
  balanceLabel:     { fontSize: 10, color: '#9E9E9E', fontWeight: '600' },
  balanceValue:     { fontSize: 13, fontWeight: '800', marginTop: 2 },
  balanceDue:       { color: '#C62828' },
  balanceClear:     { color: '#2E7D32' },
  emptyWrap:        { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:        { fontSize: 40, marginBottom: 8 },
  emptyTitle:       { fontSize: 16, fontWeight: '800', color: '#424242' },
  emptySub:         { fontSize: 12, color: '#757575', marginTop: 4, textAlign: 'center' },
  modalContainer:   { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent:     { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle:       { fontSize: 17, fontWeight: '800', marginBottom: 16, color: G_DARK },
  input:            { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, backgroundColor: '#FAFAFA' },
  modalActions:     { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn:        { paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText:    { color: '#757575', fontWeight: '700' },
  saveBtn:          { backgroundColor: G_DARK, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  saveBtnText:      { color: '#fff', fontWeight: '800' },
});

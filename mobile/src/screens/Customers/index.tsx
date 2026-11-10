import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';

export interface Customer {
  id: string;
  name: string;
  tradeName?: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  stateCode: string;
  stateName: string;
  billingAddress: string;
  outstandingBalance: number;
  creditLimit: number;
}

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_1',
    name: 'Bharat Industrial Supplies LLP',
    tradeName: 'Bharat Supplies',
    gstin: '27AABCB9876Q1ZB',
    pan: 'AABCB9876Q',
    phone: '+91 98220 12345',
    email: 'accounts@bharatsupplies.com',
    stateCode: '27',
    stateName: 'Maharashtra',
    billingAddress: 'Gala 102, Shanti Industrial Estate, Thane West, MH - 400601',
    outstandingBalance: 148500,
    creditLimit: 500000,
  },
  {
    id: 'cust_2',
    name: 'Bangalore Precision Forge Pvt Ltd',
    tradeName: 'Bangalore Forge',
    gstin: '29AACCH5678Q1Z2',
    pan: 'AACCH5678Q',
    phone: '+91 98450 78901',
    email: 'billing@bengaluruforge.in',
    stateCode: '29',
    stateName: 'Karnataka',
    billingAddress: 'Plot 44, Peenya 3rd Phase, Bangalore, KA - 560058',
    outstandingBalance: 384200,
    creditLimit: 1000000,
  },
  {
    id: 'cust_3',
    name: 'Rajesh Enterprises (Proprietor)',
    tradeName: 'Rajesh Electricals',
    gstin: '', // Unregistered consumer / composition
    pan: 'BQZPR9912K',
    phone: '+91 99300 45678',
    email: 'rajeshelectricals@gmail.com',
    stateCode: '27',
    stateName: 'Maharashtra',
    billingAddress: 'Shop 4, Station Road, Kalyan, MH - 421301',
    outstandingBalance: 0,
    creditLimit: 100000,
  },
  {
    id: 'cust_4',
    name: 'Capital Infrastructure Limited',
    tradeName: 'Capital Infra',
    gstin: '07AAECM7890K1Z9',
    pan: 'AAECM7890K',
    phone: '+91 98110 55443',
    email: 'tax@capitalinfra.in',
    stateCode: '07',
    stateName: 'Delhi',
    billingAddress: 'Building 12, Barakhamba Road, Connaught Place, New Delhi - 110001',
    outstandingBalance: 512000,
    creditLimit: 2500000,
  },
];

const INDIAN_STATES = [
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '07', name: 'Delhi' },
  { code: '24', name: 'Gujarat' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '19', name: 'West Bengal' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '06', name: 'Haryana' },
];

export const CustomersScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'WITH_GSTIN' | 'OUTSTANDING'>('ALL');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<Customer>({
    id: '',
    name: '',
    tradeName: '',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    stateCode: '27',
    stateName: 'Maharashtra',
    billingAddress: '',
    outstandingBalance: 0,
    creditLimit: 200000,
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      let matchesFilter = true;
      if (filterType === 'WITH_GSTIN') {
        matchesFilter = !!c.gstin;
      } else if (filterType === 'OUTSTANDING') {
        matchesFilter = c.outstandingBalance > 0;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        c.gstin.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [customers, filterType, searchQuery]);

  const handleGstinInput = (text: string) => {
    const clean = text.toUpperCase().trim();
    let stateCode = formData.stateCode;
    let stateName = formData.stateName;
    let pan = formData.pan;

    if (clean.length >= 2) {
      const code = clean.substring(0, 2);
      const match = INDIAN_STATES.find((s) => s.code === code);
      if (match) {
        stateCode = match.code;
        stateName = match.name;
      }
    }

    if (clean.length >= 12) {
      pan = clean.substring(2, 12);
    }

    setFormData({
      ...formData,
      gstin: clean,
      stateCode,
      stateName,
      pan,
    });
  };

  const handleOpenAddModal = () => {
    setFormData({
      id: `cust_${Date.now()}`,
      name: '',
      tradeName: '',
      gstin: '',
      pan: '',
      phone: '',
      email: '',
      stateCode: '27',
      stateName: 'Maharashtra',
      billingAddress: '',
      outstandingBalance: 0,
      creditLimit: 200000,
    });
    setIsModalVisible(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setFormData(customer);
    setIsModalVisible(true);
  };

  const handleSaveCustomer = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Customer Legal Name is required.');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Validation Error', 'Phone number is required for invoicing.');
      return;
    }

    const existingIndex = customers.findIndex((c) => c.id === formData.id);
    if (existingIndex >= 0) {
      const updated = [...customers];
      updated[existingIndex] = formData;
      setCustomers(updated);
    } else {
      setCustomers([formData, ...customers]);
    }
    setIsModalVisible(false);
  };

  const handleCreateInvoiceForCustomer = (cust: Customer) => {
    if (navigation?.navigate) {
      navigation.navigate('InvoiceCreate', {
        initialCustomer: {
          name: cust.name,
          gstin: cust.gstin,
          phone: cust.phone,
          stateCode: cust.stateCode,
          stateName: cust.stateName,
          billingAddress: cust.billingAddress,
        },
      });
    } else {
      Alert.alert('Invoicing', `Opening invoice form for ${cust.name}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Customers Directory</Text>
          <Text style={styles.subTitle}>Client GSTINs & Master Records</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
          <Text style={styles.addBtnText}>+ Add Customer</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer by name, GSTIN, phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'ALL' && styles.filterChipActive]}
          onPress={() => setFilterType('ALL')}
        >
          <Text
            style={[styles.filterChipText, filterType === 'ALL' && styles.filterChipTextActive]}
          >
            All ({customers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filterType === 'WITH_GSTIN' && styles.filterChipActive]}
          onPress={() => setFilterType('WITH_GSTIN')}
        >
          <Text
            style={[styles.filterChipText, filterType === 'WITH_GSTIN' && styles.filterChipTextActive]}
          >
            Registered (GST)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filterType === 'OUTSTANDING' && styles.filterChipActive]}
          onPress={() => setFilterType('OUTSTANDING')}
        >
          <Text
            style={[styles.filterChipText, filterType === 'OUTSTANDING' && styles.filterChipTextActive]}
          >
            With Outstanding
          </Text>
        </TouchableOpacity>
      </View>

      {/* Customers List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.custName}>{item.name}</Text>
                {item.tradeName ? (
                  <Text style={styles.tradeName}>Trade: {item.tradeName}</Text>
                ) : null}
              </View>

              {item.gstin ? (
                <View style={styles.gstinBadge}>
                  <Text style={styles.gstinBadgeText}>GSTIN VERIFIED</Text>
                </View>
              ) : (
                <View style={styles.unregisteredBadge}>
                  <Text style={styles.unregisteredBadgeText}>UNREGISTERED</Text>
                </View>
              )}
            </View>

            <View style={styles.detailsGrid}>
              <Text style={styles.detailText}>
                GSTIN: <Text style={styles.detailVal}>{item.gstin || 'None (Consumer)'}</Text>
              </Text>
              <Text style={styles.detailText}>
                State: <Text style={styles.detailVal}>{item.stateName} ({item.stateCode})</Text>
              </Text>
              <Text style={styles.detailText}>
                Phone: <Text style={styles.detailVal}>{item.phone}</Text>
              </Text>
              <Text style={styles.detailText}>
                Email: <Text style={styles.detailVal}>{item.email || 'N/A'}</Text>
              </Text>
            </View>

            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.balanceLabel}>Outstanding Balance</Text>
                <Text
                  style={[
                    styles.balanceVal,
                    item.outstandingBalance > 0 ? styles.balanceDue : styles.balanceNil,
                  ]}
                >
                  ₹{item.outstandingBalance.toLocaleString('en-IN')}.00
                </Text>
              </View>

              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={styles.actionBtnEdit}
                  onPress={() => handleOpenEditModal(item)}
                >
                  <Text style={styles.actionTextEdit}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnInvoice}
                  onPress={() => handleCreateInvoiceForCustomer(item)}
                >
                  <Text style={styles.actionTextInvoice}>+ Invoice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Customers Found</Text>
            <Text style={styles.emptySub}>
              Tap "+ Add Customer" to add your first client profile.
            </Text>
          </View>
        }
      />

      {/* Customer Add/Edit Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {customers.some((c) => c.id === formData.id)
                ? 'Edit Customer Details'
                : 'Add New Customer'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Legal Business / Party Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder="e.g. Acme Industrial Solutions Pvt Ltd"
              />

              <Text style={styles.label}>Trade Name (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.tradeName}
                onChangeText={(val) => setFormData({ ...formData, tradeName: val })}
                placeholder="e.g. Acme Hardware"
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1.3, marginRight: 8 }}>
                  <Text style={styles.label}>GSTIN (15 Digits)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.gstin}
                    onChangeText={handleGstinInput}
                    placeholder="27AA..."
                    autoCapitalize="characters"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>PAN</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.pan}
                    onChangeText={(val) =>
                      setFormData({ ...formData, pan: val.toUpperCase() })
                    }
                    placeholder="Auto from GST"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Phone Number *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.phone}
                    onChangeText={(val) => setFormData({ ...formData, phone: val })}
                    placeholder="+91..."
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.email}
                    onChangeText={(val) => setFormData({ ...formData, email: val })}
                    placeholder="billing@..."
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>State Code</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={`${formData.stateName} (${formData.stateCode})`}
                    onChangeText={(val) =>
                      setFormData({ ...formData, stateCode: val.slice(0, 2) })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Credit Limit (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.creditLimit.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setFormData({
                        ...formData,
                        creditLimit: parseFloat(val) || 0,
                      })
                    }
                  />
                </View>
              </View>

              <Text style={styles.label}>Billing Address</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                value={formData.billingAddress}
                onChangeText={(val) =>
                  setFormData({ ...formData, billingAddress: val })
                }
                multiline
                placeholder="Door No, Street, City, Pincode"
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveCustomer}
              >
                <Text style={styles.saveBtnText}>Save Customer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: '#0F172A',
  },
  clearText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 10,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#1E293B',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  tradeName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  gstinBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gstinBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  unregisteredBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unregisteredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  detailsGrid: {
    marginTop: 8,
    paddingVertical: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  detailVal: {
    fontWeight: '600',
    color: '#1E293B',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  balanceLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  balanceVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  balanceDue: {
    color: '#DC2626',
  },
  balanceNil: {
    color: '#059669',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnEdit: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionTextEdit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  actionBtnInvoice: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionTextInvoice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  formRow: {
    flexDirection: 'row',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CustomersScreen;


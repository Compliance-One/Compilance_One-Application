import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { InvoiceCard, InvoiceCardData, InvoiceStatus, formatINR } from '../../components/InvoiceCard';

const INITIAL_INVOICES: InvoiceCardData[] = [
  {
    id: 'inv_101',
    invoiceNumber: 'APX-26/0147',
    customerName: 'Shree Balaji Enterprises',
    customerGstin: '27AAECB9123F1ZV',
    date: '2026-11-09T10:30:00Z',
    dueDate: '2026-11-24T10:30:00Z',
    totalAmount: 148500.0,
    balanceDue: 0,
    status: 'PAID',
    itemsCount: 4,
  },
  {
    id: 'inv_102',
    invoiceNumber: 'APX-26/0146',
    customerName: 'Hindustan Machine Tools Ltd',
    customerGstin: '29AACCH5678Q1Z2',
    date: '2026-11-08T15:20:00Z',
    dueDate: '2026-11-23T15:20:00Z',
    totalAmount: 384200.0,
    balanceDue: 384200.0,
    status: 'PENDING',
    itemsCount: 8,
  },
  {
    id: 'inv_103',
    invoiceNumber: 'APX-26/0145',
    customerName: 'Navratna Engineering Works',
    customerGstin: '27AABCN3456P1ZX',
    date: '2026-10-25T11:00:00Z',
    dueDate: '2026-11-04T11:00:00Z',
    totalAmount: 76500.0,
    balanceDue: 76500.0,
    status: 'OVERDUE',
    itemsCount: 2,
  },
  {
    id: 'inv_104',
    invoiceNumber: 'APX-26/0144',
    customerName: 'Metro Infraworks Corp',
    customerGstin: '07AAECM7890K1Z9',
    date: '2026-10-20T14:45:00Z',
    dueDate: '2026-11-05T14:45:00Z',
    totalAmount: 512000.0,
    balanceDue: 0,
    status: 'PAID',
    itemsCount: 15,
  },
  {
    id: 'inv_105',
    invoiceNumber: 'APX-26/0143',
    customerName: 'Siddhi Vinayak Traders',
    customerGstin: '27AAMFS4432B1ZM',
    date: '2026-10-18T09:15:00Z',
    dueDate: '2026-11-02T09:15:00Z',
    totalAmount: 22400.0,
    balanceDue: 0,
    status: 'CANCELLED',
    itemsCount: 1,
  },
];

const FILTER_TABS: { label: string; value: 'ALL' | InvoiceStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export const InvoicesListScreen: React.FC<{ navigation?: any }> = ({
  navigation,
}) => {
  const [invoices, setInvoices] = useState<InvoiceCardData[]>(INITIAL_INVOICES);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Calculations for KPI Summary
  const { totalSales, totalPending, pendingCount } = useMemo(() => {
    let sales = 0;
    let pending = 0;
    let pCount = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'CANCELLED') {
        sales += inv.totalAmount;
      }
      if (inv.status === 'PENDING' || inv.status === 'OVERDUE') {
        pending += inv.balanceDue || inv.totalAmount;
        pCount += 1;
      }
    });

    return { totalSales: sales, totalPending: pending, pendingCount: pCount };
  }, [invoices]);

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchFilter =
        activeFilter === 'ALL' ? true : inv.status === activeFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.customerGstin && inv.customerGstin.toLowerCase().includes(q));

      return matchFilter && matchQuery;
    });
  }, [invoices, activeFilter, searchQuery]);

  const onRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  const handleInvoicePress = (invoice: InvoiceCardData) => {
    Alert.alert(
      invoice.invoiceNumber,
      `Customer: ${invoice.customerName}\nAmount: ${formatINR(
        invoice.totalAmount
      )}\nStatus: ${invoice.status}`
    );
  };

  const handleDownload = (invoice: InvoiceCardData) => {
    Alert.alert('Download Started', `Downloading PDF for ${invoice.invoiceNumber}`);
  };

  const handleShare = (invoice: InvoiceCardData) => {
    Alert.alert('Share Invoice', `Sharing ${invoice.invoiceNumber} via WhatsApp / Email`);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tax Invoices</Text>
          <Text style={styles.subTitle}>Sales & Compliance Invoices</Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.voiceBtn}
            onPress={() => navigation?.navigate && navigation.navigate('VoiceBilling')}
          >
            <Text style={styles.voiceBtnText}>🎤 Voice Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => navigation?.navigate && navigation.navigate('InvoiceCreate')}
          >
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Stats Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Sales</Text>
          <Text style={styles.kpiValue}>{formatINR(totalSales)}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Outstanding ({pendingCount})</Text>
          <Text style={[styles.kpiValue, styles.kpiOutstanding]}>
            {formatINR(totalPending)}
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer name, invoice #, GSTIN..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.filterTab,
              activeFilter === tab.value && styles.activeFilterTab,
            ]}
            onPress={() => setActiveFilter(tab.value)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.value && styles.activeFilterTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Invoices List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InvoiceCard
            invoice={item}
            onPress={handleInvoicePress}
            onDownload={handleDownload}
            onShare={handleShare}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No Invoices Found</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? 'Try a different search keyword'
                : 'Create your first invoice by tapping + New or Voice Bill'}
            </Text>
          </View>
        }
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  newBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCard: {
    flex: 1,
  },
  kpiDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  kpiOutstanding: {
    color: '#DC2626',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
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
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 10,
    gap: 6,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  activeFilterTab: {
    backgroundColor: '#1E293B',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
});

export default InvoicesListScreen;


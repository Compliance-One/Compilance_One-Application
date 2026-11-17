import React, { useCallback, useState, useMemo } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { InvoiceCard, InvoiceCardData, InvoiceStatus, formatINR } from '../../components/InvoiceCard';
import { useAppStore } from '../../store/useAppStore';
import { getDb } from '../../db/schema';
import { listInvoices } from '../../db/repositories';
import { displayPaymentStatus } from '../../lib/paymentStatus';
import { localISODate } from '../../lib/dates';
import { alertActionError, printInvoiceById, shareInvoicePdfById } from '../../billing/invoiceActions';


const FILTER_TABS: { label: string; value: 'ALL' | InvoiceStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export const InvoicesListScreen: React.FC<{ navigation?: any }> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const businessId = useAppStore((s) => s.business?.id);
  const [invoices, setInvoices] = useState<InvoiceCardData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const reload = useCallback(async () => {
    if (!businessId) return;
    const db = await getDb();
    const rows = await listInvoices(db, businessId);
    const today = localISODate();
    setInvoices(
      rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        customerName: r.customerName,
        customerGstin: r.customerGstin,
        date: r.date,
        dueDate: r.dueDate,
        totalAmount: r.totalAmount,
        balanceDue: r.balanceDue,
        status: displayPaymentStatus(r.paymentStatus, r.dueDate, today),
        itemsCount: r.itemsCount,
      }))
    );
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  // Calculations for KPI Summary
  const { totalSales, totalPending, pendingCount } = useMemo(() => {
    let sales = 0;
    let pending = 0;
    let pCount = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'CANCELLED') {
        sales += inv.totalAmount;
      }
      if (inv.status === 'UNPAID' || inv.status === 'PARTIAL' || inv.status === 'OVERDUE') {
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
    void reload().finally(() => setIsRefreshing(false));
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
    void shareInvoicePdfById(invoice.id).catch((err) => alertActionError(err, 'PDF'));
  };

  const handleShare = (invoice: InvoiceCardData) => {
    void shareInvoicePdfById(invoice.id).catch((err) => alertActionError(err, 'Share PDF'));
  };

  const handlePrint = (invoice: InvoiceCardData) => {
    void printInvoiceById(invoice.id).catch((err) => alertActionError(err, 'Print'));
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('tabs.invoices')}</Text>
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
            onPrint={handlePrint}
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


import React, { useCallback, useState, useMemo } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { getDb } from '../../db/schema';
import { adjustProductStock, listProducts } from '../../db/repositories';

export type AdjustmentType = 'STOCK_IN' | 'STOCK_OUT' | 'DAMAGE' | 'AUDIT_CORRECTION';

export interface InventoryItem {
  id: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  unitCost: number;
  currentStock: number;
  reorderLevel: number;
  lastAdjustedAt: string;
}

export interface StockAdjustmentRecord {
  id: string;
  productId: string;
  productName: string;
  type: AdjustmentType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
}


const ADJUSTMENT_OPTIONS: { type: AdjustmentType; label: string; color: string }[] = [
  { type: 'STOCK_IN', label: 'Stock In (Purchase)', color: '#16A34A' },
  { type: 'STOCK_OUT', label: 'Stock Out (Sale / Usage)', color: '#2563EB' },
  { type: 'DAMAGE', label: 'Damage / Wastage', color: '#DC2626' },
  { type: 'AUDIT_CORRECTION', label: 'Physical Audit Count', color: '#D97706' },
];

export const InventoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const businessId = useAppStore((s) => s.business?.id);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const reload = useCallback(async () => {
    if (!businessId) return;
    const db = await getDb();
    const products = await listProducts(db, businessId);
    setInventory(
      products.map((p) => ({
        id: p.id,
        productName: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        unitCost: p.purchasePrice || p.sellingPrice,
        currentStock: p.currentStock,
        reorderLevel: p.minStockLevel,
        lastAdjustedAt: '',
      }))
    );
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Adjustment Modal
  const [isAdjustModalVisible, setIsAdjustModalVisible] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('STOCK_IN');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('10');
  const [adjustReason, setAdjustReason] = useState<string>('Purchase Inward from Supplier');

  // Metrics
  const { totalValuation, lowStockCount, outOfStockCount } = useMemo(() => {
    let val = 0;
    let low = 0;
    let out = 0;

    inventory.forEach((item) => {
      val += item.currentStock * item.unitCost;
      if (item.currentStock <= 0) {
        out += 1;
      } else if (item.currentStock <= item.reorderLevel) {
        low += 1;
      }
    });

    return { totalValuation: val, lowStockCount: low, outOfStockCount: out };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (filterMode === 'LOW_STOCK' && (item.currentStock > item.reorderLevel || item.currentStock === 0)) {
        return false;
      }
      if (filterMode === 'OUT_OF_STOCK' && item.currentStock > 0) {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [inventory, filterMode, searchQuery]);

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentType('STOCK_IN');
    setAdjustQuantity('5');
    setAdjustReason('PO Inward Goods Receipt');
    setIsAdjustModalVisible(true);
  };

  const handleApplyAdjustment = () => {
    if (!selectedItem) return;
    const qty = parseInt(adjustQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(t('inventory.invalidQtyTitle'), t('inventory.invalidQty'));
      return;
    }

    let delta = 0;
    let newQty = selectedItem.currentStock;

    if (adjustmentType === 'STOCK_IN') {
      delta = qty;
      newQty = selectedItem.currentStock + qty;
    } else if (adjustmentType === 'STOCK_OUT' || adjustmentType === 'DAMAGE') {
      if (selectedItem.currentStock < qty) {
        Alert.alert(t('inventory.insufficientTitle'), t('inventory.insufficientBody', { qty: selectedItem.currentStock, unit: selectedItem.unit }));
        return;
      }
      delta = -qty;
      newQty = selectedItem.currentStock - qty;
    } else if (adjustmentType === 'AUDIT_CORRECTION') {
      delta = qty - selectedItem.currentStock;
      newQty = qty;
    }

    if (!businessId) return;
    void (async () => {
      try {
        const db = await getDb();
        await adjustProductStock(db, businessId, selectedItem.id, newQty);
        await reload();
        setIsAdjustModalVisible(false);
        Alert.alert(
          t('inventory.adjusted'),
          t('inventory.adjustedBody', { name: selectedItem.productName, qty: newQty, unit: selectedItem.unit })
        );
      } catch (e) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
      }
    })();
  };

  const getStockStatusTag = (stock: number, reorder: number) => {
    if (stock <= 0) {
      return { label: 'OUT OF STOCK', bg: '#FEE2E2', color: '#DC2626' };
    }
    if (stock <= reorder) {
      return { label: 'LOW STOCK', bg: '#FEF3C7', color: '#D97706' };
    }
    return { label: 'IN STOCK', bg: '#ECFDF5', color: '#059669' };
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('inventory.title')}</Text>
          <Text style={styles.subTitle}>{t('inventory.subtitle')}</Text>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{t('inventory.stockValuation')}</Text>
          <Text style={styles.kpiValue}>
            ₹{totalValuation.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{t('inventory.lowStock')}</Text>
          <Text style={[styles.kpiValue, { color: '#D97706' }]}>
            {lowStockCount} Items
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{t('inventory.outOfStock')}</Text>
          <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
            {outOfStockCount} Items
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('inventory.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, filterMode === 'ALL' && styles.tabActive]}
          onPress={() => setFilterMode('ALL')}
        >
          <Text style={[styles.tabText, filterMode === 'ALL' && styles.tabTextActive]}>
            All Items ({inventory.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filterMode === 'LOW_STOCK' && styles.tabActive]}
          onPress={() => setFilterMode('LOW_STOCK')}
        >
          <Text style={[styles.tabText, filterMode === 'LOW_STOCK' && styles.tabTextActive]}>
            Low Stock ({lowStockCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filterMode === 'OUT_OF_STOCK' && styles.tabActive]}
          onPress={() => setFilterMode('OUT_OF_STOCK')}
        >
          <Text style={[styles.tabText, filterMode === 'OUT_OF_STOCK' && styles.tabTextActive]}>
            Out of Stock ({outOfStockCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stock Items List */}
      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const status = getStockStatusTag(item.currentStock, item.reorderLevel);
          const valuation = item.currentStock * item.unitCost;

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.skuText}>
                    SKU: {item.sku} • {item.category}
                  </Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
              </View>

              <View style={styles.stockDetailsRow}>
                <View style={styles.stockCol}>
                  <Text style={styles.colLabel}>{t('inventory.currentStock')}</Text>
                  <Text style={styles.stockNumber}>
                    {item.currentStock}{' '}
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </Text>
                </View>

                <View style={styles.stockCol}>
                  <Text style={styles.colLabel}>{t('inventory.reorderLevel')}</Text>
                  <Text style={styles.reorderNumber}>
                    {item.reorderLevel} {item.unit}
                  </Text>
                </View>

                <View style={styles.stockCol}>
                  <Text style={styles.colLabel}>{t('inventory.assetValue')}</Text>
                  <Text style={styles.assetValue}>
                    ₹{valuation.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.lastAdjustedText}>
                  Cost: ₹{item.unitCost}/{item.unit}
                </Text>

                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => handleOpenAdjust(item)}
                >
                  <Text style={styles.adjustBtnText}>± Adjust Stock</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>{t('inventory.emptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('inventory.emptySub')}</Text>
          </View>
        }
      />

      {/* Stock Adjustment Modal */}
      <Modal
        visible={isAdjustModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAdjustModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('inventory.adjustTitle')}</Text>
            {selectedItem && (
              <Text style={styles.modalSubtitle}>
                {selectedItem.productName} (Current: {selectedItem.currentStock} {selectedItem.unit})
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>{t('inventory.reasonType')}</Text>
              <View style={styles.typeGrid}>
                {ADJUSTMENT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      styles.typeOption,
                      adjustmentType === opt.type && {
                        borderColor: opt.color,
                        backgroundColor: '#F8FAFC',
                      },
                    ]}
                    onPress={() => setAdjustmentType(opt.type)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        adjustmentType === opt.type && {
                          color: opt.color,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                {adjustmentType === 'AUDIT_CORRECTION'
                  ? 'New Verified Physical Count'
                  : 'Adjustment Quantity'}
              </Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={adjustQuantity}
                onChangeText={setAdjustQuantity}
                placeholder={t('inventory.qtyPlaceholder')}
              />

              <Text style={styles.inputLabel}>{t('inventory.remarks')}</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                value={adjustReason}
                onChangeText={setAdjustReason}
                multiline
                placeholder={t('inventory.reasonPlaceholder')}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAdjustModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleApplyAdjustment}
              >
                <Text style={styles.confirmBtnText}>{t('inventory.apply')}</Text>
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
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  searchBar: {
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
  clearSearch: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 10,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  tabActive: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tabTextActive: {
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
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  skuText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stockDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  stockCol: {
    alignItems: 'center',
  },
  colLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  stockNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  unitText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  reorderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 2,
  },
  assetValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  lastAdjustedText: {
    fontSize: 11,
    color: '#64748B',
  },
  adjustBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adjustBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
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
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    marginTop: 10,
  },
  typeGrid: {
    gap: 6,
  },
  typeOption: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  typeOptionText: {
    fontSize: 12,
    color: '#334155',
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
  modalActions: {
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
  confirmBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default InventoryScreen;


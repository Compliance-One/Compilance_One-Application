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

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv_item_1',
    productName: 'UltraTech Super Cement (50kg Bag)',
    sku: 'CMT-ULT-50',
    category: 'Building Materials',
    unit: 'BAG',
    unitCost: 330,
    currentStock: 120,
    reorderLevel: 30,
    lastAdjustedAt: '2026-11-09T14:00:00Z',
  },
  {
    id: 'inv_item_2',
    productName: 'Havells Modular Switch 10A 1-Way',
    sku: 'SW-HAV-10A',
    category: 'Electricals',
    unit: 'PCS',
    unitCost: 95,
    currentStock: 8,
    reorderLevel: 25,
    lastAdjustedAt: '2026-11-08T18:30:00Z',
  },
  {
    id: 'inv_item_3',
    productName: 'Asian Paints Apex Ultima White 20L',
    sku: 'PNT-APX-20L',
    category: 'Paints',
    unit: 'CAN',
    unitCost: 3450,
    currentStock: 0,
    reorderLevel: 5,
    lastAdjustedAt: '2026-11-07T11:15:00Z',
  },
  {
    id: 'inv_item_4',
    productName: 'Industrial Ball Valve 2 Inch Brass',
    sku: 'VLV-BRS-02',
    category: 'Plumbing',
    unit: 'PCS',
    unitCost: 950,
    currentStock: 45,
    reorderLevel: 10,
    lastAdjustedAt: '2026-11-05T09:20:00Z',
  },
  {
    id: 'inv_item_5',
    productName: 'High Tensile Hex Bolt M12 x 50mm',
    sku: 'BLT-HT-1250',
    category: 'Hardware',
    unit: 'BOX',
    unitCost: 360,
    currentStock: 64,
    reorderLevel: 15,
    lastAdjustedAt: '2026-10-31T16:45:00Z',
  },
];

const ADJUSTMENT_OPTIONS: { type: AdjustmentType; label: string; color: string }[] = [
  { type: 'STOCK_IN', label: 'Stock In (Purchase)', color: '#16A34A' },
  { type: 'STOCK_OUT', label: 'Stock Out (Sale / Usage)', color: '#2563EB' },
  { type: 'DAMAGE', label: 'Damage / Wastage', color: '#DC2626' },
  { type: 'AUDIT_CORRECTION', label: 'Physical Audit Count', color: '#D97706' },
];

export const InventoryScreen: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
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
      Alert.alert('Invalid Quantity', 'Please enter a positive numeric quantity.');
      return;
    }

    let delta = 0;
    let newQty = selectedItem.currentStock;

    if (adjustmentType === 'STOCK_IN') {
      delta = qty;
      newQty = selectedItem.currentStock + qty;
    } else if (adjustmentType === 'STOCK_OUT' || adjustmentType === 'DAMAGE') {
      if (selectedItem.currentStock < qty) {
        Alert.alert('Insufficient Stock', `Available stock is only ${selectedItem.currentStock} ${selectedItem.unit}.`);
        return;
      }
      delta = -qty;
      newQty = selectedItem.currentStock - qty;
    } else if (adjustmentType === 'AUDIT_CORRECTION') {
      delta = qty - selectedItem.currentStock;
      newQty = qty;
    }

    const updated = inventory.map((it) =>
      it.id === selectedItem.id
        ? {
            ...it,
            currentStock: newQty,
            lastAdjustedAt: new Date().toISOString(),
          }
        : it
    );

    setInventory(updated);
    setIsAdjustModalVisible(false);

    Alert.alert(
      'Stock Adjusted',
      `Inventory for "${selectedItem.productName}" updated to ${newQty} ${selectedItem.unit}.`
    );
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
          <Text style={styles.title}>Inventory Management</Text>
          <Text style={styles.subTitle}>Live Stock & Reorder Monitoring</Text>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Stock Valuation</Text>
          <Text style={styles.kpiValue}>
            ₹{totalValuation.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Low Stock Alert</Text>
          <Text style={[styles.kpiValue, { color: '#D97706' }]}>
            {lowStockCount} Items
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Out of Stock</Text>
          <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
            {outOfStockCount} Items
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory by item name, SKU..."
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
                  <Text style={styles.colLabel}>Current Stock</Text>
                  <Text style={styles.stockNumber}>
                    {item.currentStock}{' '}
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </Text>
                </View>

                <View style={styles.stockCol}>
                  <Text style={styles.colLabel}>Reorder Level</Text>
                  <Text style={styles.reorderNumber}>
                    {item.reorderLevel} {item.unit}
                  </Text>
                </View>

                <View style={styles.stockCol}>
                  <Text style={styles.colLabel}>Asset Value</Text>
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
            <Text style={styles.emptyTitle}>No Stock Records Found</Text>
            <Text style={styles.emptySub}>No items match the selected filter.</Text>
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
            <Text style={styles.modalTitle}>Adjust Inventory Level</Text>
            {selectedItem && (
              <Text style={styles.modalSubtitle}>
                {selectedItem.productName} (Current: {selectedItem.currentStock} {selectedItem.unit})
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Adjustment Reason / Type</Text>
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
                placeholder="Enter quantity"
              />

              <Text style={styles.inputLabel}>Remarks / Reference No.</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                value={adjustReason}
                onChangeText={setAdjustReason}
                multiline
                placeholder="e.g. GRN-2026-99 or physical audit mismatch"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAdjustModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleApplyAdjustment}
              >
                <Text style={styles.confirmBtnText}>Apply Adjustment</Text>
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


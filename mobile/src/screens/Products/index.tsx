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

export interface Product {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  category: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
  taxRate: number; // 0, 5, 12, 18, 28
  currentStock: number;
  minStockLevel: number;
}

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Industrial Ball Valve 2 Inch Brass',
    sku: 'VLV-BRS-02',
    hsnCode: '84818030',
    category: 'Plumbing',
    unit: 'PCS',
    sellingPrice: 1250,
    purchasePrice: 950,
    taxRate: 18,
    currentStock: 45,
    minStockLevel: 10,
  },
  {
    id: 'prod_2',
    name: 'UltraTech Super Cement (50kg Bag)',
    sku: 'CMT-ULT-50',
    hsnCode: '25232900',
    category: 'Building Materials',
    unit: 'BAG',
    sellingPrice: 380,
    purchasePrice: 330,
    taxRate: 28,
    currentStock: 120,
    minStockLevel: 30,
  },
  {
    id: 'prod_3',
    name: 'Havells Modular Switch 10A 1-Way',
    sku: 'SW-HAV-10A',
    hsnCode: '85365020',
    category: 'Electricals',
    unit: 'PCS',
    sellingPrice: 140,
    purchasePrice: 95,
    taxRate: 18,
    currentStock: 8,
    minStockLevel: 25, // Low stock!
  },
  {
    id: 'prod_4',
    name: 'Asian Paints Apex Ultima White 20L',
    sku: 'PNT-APX-20L',
    hsnCode: '32091000',
    category: 'Paints',
    unit: 'CAN',
    sellingPrice: 4200,
    purchasePrice: 3450,
    taxRate: 18,
    currentStock: 0,
    minStockLevel: 5, // Out of stock!
  },
  {
    id: 'prod_5',
    name: 'High Tensile Hex Bolt M12 x 50mm',
    sku: 'BLT-HT-1250',
    hsnCode: '73181500',
    category: 'Hardware',
    unit: 'BOX',
    sellingPrice: 480,
    purchasePrice: 360,
    taxRate: 18,
    currentStock: 64,
    minStockLevel: 15,
  },
];

const CATEGORIES = ['All', 'Plumbing', 'Electricals', 'Hardware', 'Paints', 'Building Materials'];
const TAX_RATES = [0, 5, 12, 18, 28];
const UNITS = ['PCS', 'BAG', 'CAN', 'BOX', 'KG', 'MTR', 'LTR'];

export const ProductsScreen: React.FC<{ navigation?: any }> = () => {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    sku: '',
    hsnCode: '',
    category: 'Hardware',
    unit: 'PCS',
    sellingPrice: 0,
    purchasePrice: 0,
    taxRate: 18,
    currentStock: 0,
    minStockLevel: 5,
  });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory =
        selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.hsnCode.includes(q);
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleOpenAddModal = () => {
    setFormData({
      id: `prod_${Date.now()}`,
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      hsnCode: '',
      category: 'Hardware',
      unit: 'PCS',
      sellingPrice: 0,
      purchasePrice: 0,
      taxRate: 18,
      currentStock: 0,
      minStockLevel: 5,
    });
    setIsModalVisible(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setFormData(prod);
    setIsModalVisible(true);
  };

  const handleSaveProduct = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Product name cannot be empty.');
      return;
    }
    if (formData.sellingPrice <= 0) {
      Alert.alert('Validation Error', 'Selling price must be greater than 0.');
      return;
    }

    const existingIndex = products.findIndex((p) => p.id === formData.id);
    if (existingIndex >= 0) {
      const updated = [...products];
      updated[existingIndex] = formData;
      setProducts(updated);
    } else {
      setProducts([formData, ...products]);
    }
    setIsModalVisible(false);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to remove "${name}" from master catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setProducts((prev) => prev.filter((p) => p.id !== id));
          },
        },
      ]
    );
  };

  const getStockBadge = (stock: number, min: number) => {
    if (stock <= 0) {
      return { label: 'OUT OF STOCK', bg: '#FEE2E2', text: '#DC2626' };
    }
    if (stock <= min) {
      return { label: `LOW (${stock})`, bg: '#FEF3C7', text: '#D97706' };
    }
    return { label: `${stock} In Stock`, bg: '#ECFDF5', text: '#059669' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Product Catalog</Text>
          <Text style={styles.subTitle}>Master Items, HSN & GST Rates</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
          <Text style={styles.addBtnText}>+ Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name, SKU, or HSN code..."
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

      {/* Category Filter Pills */}
      <View style={styles.categoryScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat && styles.categoryChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const badge = getStockBadge(item.currentStock, item.minStockLevel);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.prodName}>{item.name}</Text>
                  <Text style={styles.prodSku}>SKU: {item.sku} • {item.category}</Text>
                </View>

                <View style={[styles.stockBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.stockBadgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>HSN: {item.hsnCode || 'N/A'}</Text>
                </View>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>GST: {item.taxRate}%</Text>
                </View>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>Unit: {item.unit}</Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>Selling Price</Text>
                  <Text style={styles.sellingPrice}>₹{item.sellingPrice.toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={styles.priceLabel}>Purchase Cost</Text>
                  <Text style={styles.purchasePrice}>₹{item.purchasePrice.toFixed(2)}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleOpenEditModal(item)}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteProduct(item.id, item.name)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Products Found</Text>
            <Text style={styles.emptySub}>
              Tap "+ Add Product" to create your first catalog item.
            </Text>
          </View>
        }
      />

      {/* Add / Edit Product Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>
              {products.some((p) => p.id === formData.id)
                ? 'Edit Catalog Product'
                : 'Add New Product'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Product Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder="e.g. Copper Wire Coil 1.5 sq mm"
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>SKU / Code</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.sku}
                    onChangeText={(val) => setFormData({ ...formData, sku: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>HSN Code</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.hsnCode}
                    onChangeText={(val) =>
                      setFormData({ ...formData, hsnCode: val })
                    }
                    placeholder="e.g. 8544"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.category}
                    onChangeText={(val) =>
                      setFormData({ ...formData, category: val })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit (UQC)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.unit}
                    onChangeText={(val) =>
                      setFormData({ ...formData, unit: val.toUpperCase() })
                    }
                    placeholder="PCS, BOX, KG"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Selling Price (₹) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.sellingPrice.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setFormData({
                        ...formData,
                        sellingPrice: parseFloat(val) || 0,
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Purchase Cost (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.purchasePrice.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setFormData({
                        ...formData,
                        purchasePrice: parseFloat(val) || 0,
                      })
                    }
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Applicable GST Rate %</Text>
              <View style={styles.taxPillRow}>
                {TAX_RATES.map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    style={[
                      styles.taxPill,
                      formData.taxRate === rate && styles.taxPillActive,
                    ]}
                    onPress={() => setFormData({ ...formData, taxRate: rate })}
                  >
                    <Text
                      style={[
                        styles.taxPillText,
                        formData.taxRate === rate && styles.taxPillTextActive,
                      ]}
                    >
                      {rate}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Current Stock</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.currentStock.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setFormData({
                        ...formData,
                        currentStock: parseInt(val, 10) || 0,
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Min Reorder Level</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.minStockLevel.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setFormData({
                        ...formData,
                        minStockLevel: parseInt(val, 10) || 0,
                      })
                    }
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProduct}
              >
                <Text style={styles.saveBtnText}>Save Product</Text>
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
  categoryScroll: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: '#1E293B',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  prodSku: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 10,
  },
  pillContainer: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  priceLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  sellingPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  purchasePrice: {
    fontSize: 13,
    color: '#64748B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 12,
    color: '#4338CA',
    fontWeight: '600',
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
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
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  inputLabel: {
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
  taxPillRow: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 4,
  },
  taxPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  taxPillActive: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  taxPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  taxPillTextActive: {
    color: '#FFFFFF',
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

export default ProductsScreen;


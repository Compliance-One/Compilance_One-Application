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
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../ui';
import { DecimalInput } from '../../ui/DecimalInput';
import { HsnPicker } from '../../ui/HsnPicker';
import { useAppStore } from '../../store/useAppStore';
import { getDb } from '../../db/schema';
import { deleteProduct, listProducts, seedHardwareCatalog, upsertProduct } from '../../db/repositories';
import { BigButton } from '../../ui';
import { newId } from '../../lib/id';

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


const CATEGORIES = ['All', 'Plumbing', 'Electricals', 'Hardware', 'Paints', 'Building Materials', 'Tools'];
const TAX_RATES = [0, 5, 12, 18, 28];
const UNITS = ['PCS', 'BAG', 'CAN', 'BOX', 'KG', 'MTR', 'LTR'];

export const ProductsScreen: React.FC<{ navigation?: any }> = () => {
  const { t } = useTranslation();
  const businessId = useAppStore((s) => s.business?.id);
  const [products, setProducts] = useState<Product[]>([]);

  const reload = useCallback(async () => {
    if (!businessId) return;
    const db = await getDb();
    setProducts(await listProducts(db, businessId));
  }, [businessId]);

  const [seeding, setSeeding] = useState(false);
  const loadStarter = useCallback(async () => {
    if (!businessId || seeding) return;
    setSeeding(true);
    try {
      const db = await getDb();
      const added = await seedHardwareCatalog(db, businessId);
      await reload();
      Alert.alert(t('products.seedDoneTitle'), added > 0 ? t('products.seedDone', { count: added }) : t('products.seedNone'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }, [businessId, seeding, reload, t]);
  const seedButton = (
    <BigButton
      icon="🧰"
      label={t('products.seedBtn')}
      sublabel={t('products.seedBtnSub')}
      variant={products.length === 0 ? 'primary' : 'secondary'}
      busy={seeding}
      onPress={() => void loadStarter()}
      style={{ marginVertical: 12 }}
    />
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );
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
    taxRate: 0,
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
      id: newId(),
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      hsnCode: '',
      category: 'Hardware',
      unit: 'PCS',
      sellingPrice: 0,
      purchasePrice: 0,
      taxRate: 0,
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
      Alert.alert(t('common.validationError'), t('products.nameRequired'));
      return;
    }
    if (formData.sellingPrice <= 0) {
      Alert.alert(t('common.validationError'), t('products.priceRequired'));
      return;
    }

    if (!businessId) return;
    const existingIndex = products.findIndex((p) => p.id === formData.id);
    const isNew = existingIndex < 0;
    void (async () => {
      try {
        const db = await getDb();
        await upsertProduct(db, businessId, formData, isNew);
        await reload();
        setIsModalVisible(false);
      } catch (e) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
      }
    })();
  };

  const handleDeleteProduct = (id: string, name: string) => {
    Alert.alert(
      t('products.deleteTitle'),
      t('products.deleteBody', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (!businessId) return;
            void (async () => {
              try {
                const db = await getDb();
                await deleteProduct(db, businessId, id);
                await reload();
              } catch (e) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
              }
            })();
          },
        },
      ]
    );
  };

  const getStockBadge = (stock: number, min: number) => {
    if (stock <= 0) {
      return { label: t('products.outOfStock'), bg: '#FEE2E2', text: '#DC2626' };
    }
    if (stock <= min) {
      return { label: t('products.lowStock', { count: stock }), bg: '#FEF3C7', text: '#D97706' };
    }
    return { label: t('products.inStock', { count: stock }), bg: '#ECFDF5', text: '#059669' };
  };

  return (
    <Screen edges={['top']} scroll={false} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('products.title')}</Text>
          <Text style={styles.subTitle}>{t('products.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
          <Text style={styles.addBtnText}>{t('products.addBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('products.searchPlaceholder')}
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
                {t(`products.categories.${cat.replace(/\s+/g, '')}`, { defaultValue: cat })}
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
        ListFooterComponent={filteredProducts.length > 0 ? seedButton : null}
        renderItem={({ item }) => {
          const badge = getStockBadge(item.currentStock, item.minStockLevel);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.prodName}>{item.name}</Text>
                  <Text style={styles.prodSku}>{t('products.skuLabel')}: {item.sku} • {item.category}</Text>
                </View>

                <View style={[styles.stockBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.stockBadgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>{t('products.hsnPill', { value: item.hsnCode || t('products.na') })}</Text>
                </View>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>{t('products.gstPill', { rate: item.taxRate })}</Text>
                </View>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>{t('products.unitPill', { unit: item.unit })}</Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>{t('products.sellingPriceLabel')}</Text>
                  <Text style={styles.sellingPrice}>₹{item.sellingPrice.toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={styles.priceLabel}>{t('products.purchaseCost')}</Text>
                  <Text style={styles.purchasePrice}>₹{item.purchasePrice.toFixed(2)}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleOpenEditModal(item)}
                  >
                    <Text style={styles.editBtnText}>{t('products.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteProduct(item.id, item.name)}
                  >
                    <Text style={styles.deleteBtnText}>{t('products.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>{t('products.emptyTitle')}</Text>
            {seedButton}
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
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>
              {products.some((p) => p.id === formData.id)
                ? t('products.editTitle')
                : t('products.addTitle')}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>{t('products.nameTitle')}</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.name}
                onChangeText={(val) => setFormData({ ...formData, name: val })}
                placeholder={t('products.namePlaceholder')}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>{t('products.skuCode')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.sku}
                    onChangeText={(val) => setFormData({ ...formData, sku: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('products.hsnCode')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.hsnCode}
                    onChangeText={(val) =>
                      setFormData({ ...formData, hsnCode: val })
                    }
                    placeholder={t('products.hsnPlaceholder')}
                    keyboardType="numeric"
                  />
                  <HsnPicker
                    initialQuery={formData.name}
                    onPick={(e) =>
                      setFormData((prev) => ({ ...prev, hsnCode: e.code, taxRate: e.rate ?? prev.taxRate }))
                    }
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>{t('products.category')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.category}
                    onChangeText={(val) =>
                      setFormData({ ...formData, category: val })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('products.unitUqc')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.unit}
                    onChangeText={(val) =>
                      setFormData({ ...formData, unit: val.toUpperCase() })
                    }
                    placeholder={t('products.unitPlaceholder')}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>{t('products.sellingPriceStar')}</Text>
                  <DecimalInput
                    style={styles.modalInput}
                    value={formData.sellingPrice}
                    decimals={2}
                    onValue={(n) => setFormData((prev) => ({ ...prev, sellingPrice: n }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('products.purchaseCostRs')}</Text>
                  <DecimalInput
                    style={styles.modalInput}
                    value={formData.purchasePrice}
                    decimals={2}
                    onValue={(n) => setFormData((prev) => ({ ...prev, purchasePrice: n }))}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>{t('products.gstRate')}</Text>
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
                  <Text style={styles.inputLabel}>{t('products.currentStock')}</Text>
                  <DecimalInput
                    style={styles.modalInput}
                    value={formData.currentStock}
                    decimals={3}
                    onValue={(n) => setFormData((prev) => ({ ...prev, currentStock: n }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('products.minReorder')}</Text>
                  <DecimalInput
                    style={styles.modalInput}
                    value={formData.minStockLevel}
                    decimals={3}
                    onValue={(n) => setFormData((prev) => ({ ...prev, minStockLevel: n }))}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>{t('products.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProduct}
              >
                <Text style={styles.saveBtnText}>{t('products.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
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


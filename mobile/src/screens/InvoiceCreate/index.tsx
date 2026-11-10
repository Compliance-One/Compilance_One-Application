import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import { useAppStore } from '../../store/useAppStore';

export interface InvoiceLineItem {
  id: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number; // e.g., 5, 12, 18, 28
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

interface CustomerState {
  name: string;
  gstin: string;
  phone: string;
  stateCode: string;
  stateName: string;
  billingAddress: string;
}

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
  { code: '23', name: 'Madhya Pradesh' },
];

const TAX_RATES = [0, 5, 12, 18, 28];
const UNITS = ['PCS', 'BOX', 'KG', 'LTR', 'MTR', 'BAG', 'SET'];

export const InvoiceCreateScreen: React.FC<{ navigation?: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const { business } = useAppStore();
  const sellerStateCode = business?.stateCode || '27';

  // Customer State
  const [customer, setCustomer] = useState<CustomerState>({
    name: route?.params?.initialCustomer?.name || 'Bharat Industrial Supplies',
    gstin: route?.params?.initialCustomer?.gstin || '27AABCB9876Q1ZB',
    phone: '9822012345',
    stateCode: '27',
    stateName: 'Maharashtra',
    billingAddress: 'Gala 102, Shanti Industrial Estate, Thane West, MH - 400601',
  });

  // Invoice Meta
  const [invoiceNumber, setInvoiceNumber] = useState<string>('APX-26/0148');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 15 Days');
  const [notes, setNotes] = useState<string>(
    'Thank you for your business. Subject to Mumbai Jurisdiction.'
  );

  // Line items
  const [items, setItems] = useState<InvoiceLineItem[]>(() => {
    if (route?.params?.initialItems && Array.isArray(route.params.initialItems)) {
      return route.params.initialItems.map((item: any, idx: number) => ({
        id: item.id || `item_${idx}`,
        name: item.name || '',
        hsnCode: item.hsnCode || '8481',
        quantity: item.quantity || 1,
        unit: item.unit || 'PCS',
        unitPrice: item.unitPrice || 0,
        discountPercent: 0,
        taxRate: item.taxRate || 18,
        taxableAmount: (item.quantity || 1) * (item.unitPrice || 0),
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalAmount: 0,
      }));
    }
    return [
      {
        id: '1',
        name: 'Heavy Duty Industrial Ball Valve 2 Inch',
        hsnCode: '84818030',
        quantity: 10,
        unit: 'PCS',
        unitPrice: 1250,
        discountPercent: 5,
        taxRate: 18,
        taxableAmount: 11875,
        cgstAmount: 1068.75,
        sgstAmount: 1068.75,
        igstAmount: 0,
        totalAmount: 14012.5,
      },
    ];
  });

  // Modal for adding / editing item
  const [isItemModalVisible, setIsItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceLineItem>({
    id: '',
    name: '',
    hsnCode: '',
    quantity: 1,
    unit: 'PCS',
    unitPrice: 0,
    discountPercent: 0,
    taxRate: 18,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalAmount: 0,
  });

  // Calculate Taxes whenever items or customer state change
  const isInterState = customer.stateCode !== sellerStateCode;

  const calculateItemRow = (
    item: Omit<
      InvoiceLineItem,
      'taxableAmount' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'totalAmount'
    >
  ): InvoiceLineItem => {
    const gross = item.quantity * item.unitPrice;
    const discount = gross * (item.discountPercent / 100);
    const taxable = gross - discount;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      igst = taxable * (item.taxRate / 100);
    } else {
      cgst = taxable * (item.taxRate / 200);
      sgst = taxable * (item.taxRate / 200);
    }

    const total = taxable + cgst + sgst + igst;

    return {
      ...item,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalAmount: total,
    };
  };

  // Recompute all items when customer state changes (e.g. from MH to KA)
  useEffect(() => {
    setItems((prev) => prev.map((it) => calculateItemRow(it)));
  }, [customer.stateCode]);

  // Overall Invoice Calculations
  const taxableSubtotal = items.reduce((acc, it) => acc + it.taxableAmount, 0);
  const totalCgst = items.reduce((acc, it) => acc + it.cgstAmount, 0);
  const totalSgst = items.reduce((acc, it) => acc + it.sgstAmount, 0);
  const totalIgst = items.reduce((acc, it) => acc + it.igstAmount, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const rawTotal = taxableSubtotal + totalTax;
  const roundedGrandTotal = Math.round(rawTotal);
  const roundOff = +(roundedGrandTotal - rawTotal).toFixed(2);

  // Auto-fill state code if 15-character GSTIN is entered
  const handleGstinChange = (text: string) => {
    const clean = text.toUpperCase().trim();
    let stateCode = customer.stateCode;
    let stateName = customer.stateName;

    if (clean.length >= 2) {
      const code = clean.substring(0, 2);
      const match = INDIAN_STATES.find((s) => s.code === code);
      if (match) {
        stateCode = match.code;
        stateName = match.name;
      }
    }
    setCustomer({
      ...customer,
      gstin: clean,
      stateCode,
      stateName,
    });
  };

  const handleOpenAddModal = () => {
    setEditingItem({
      id: `item_${Date.now()}`,
      name: '',
      hsnCode: '',
      quantity: 1,
      unit: 'PCS',
      unitPrice: 0,
      discountPercent: 0,
      taxRate: 18,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    });
    setIsItemModalVisible(true);
  };

  const handleSaveModalItem = () => {
    if (!editingItem.name.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }
    if (editingItem.unitPrice <= 0) {
      Alert.alert('Validation Error', 'Unit price must be greater than 0.');
      return;
    }

    const calculated = calculateItemRow(editingItem);
    const existingIndex = items.findIndex((it) => it.id === calculated.id);

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = calculated;
      setItems(updated);
    } else {
      setItems([...items, calculated]);
    }
    setIsItemModalVisible(false);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleEditItem = (item: InvoiceLineItem) => {
    setEditingItem(item);
    setIsItemModalVisible(true);
  };

  const handleSubmitInvoice = () => {
    if (!customer.name.trim()) {
      Alert.alert('Missing Customer', 'Please specify a customer name.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('No Items', 'Please add at least one line item to the invoice.');
      return;
    }

    Alert.alert(
      'Invoice Created Successfully',
      `Invoice #${invoiceNumber} for ₹${roundedGrandTotal.toFixed(
        2
      )} has been generated and ready for sharing.`,
      [
        {
          text: 'View Invoices',
          onPress: () => navigation?.navigate && navigation.navigate('InvoicesList'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>New Tax Invoice</Text>
          <Text style={styles.subTitle}>GST Compliance Rule 46 Format</Text>
        </View>
        <TouchableOpacity style={styles.saveDraftBtn} onPress={() => Alert.alert('Draft Saved')}>
          <Text style={styles.saveDraftText}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Invoice Meta */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Invoice Metadata</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Invoice Number</Text>
              <TextInput
                style={styles.input}
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Invoice Date</Text>
              <TextInput
                style={styles.input}
                value={invoiceDate}
                onChangeText={setInvoiceDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Payment Terms</Text>
              <TextInput
                style={styles.input}
                value={paymentTerms}
                onChangeText={setPaymentTerms}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Seller State</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>
                  State Code: {sellerStateCode}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer / Buyer Details */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Bill To (Customer Details)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1.5, marginRight: 8 }}>
              <Text style={styles.label}>Customer Legal Name</Text>
              <TextInput
                style={styles.input}
                value={customer.name}
                onChangeText={(val) => setCustomer({ ...customer, name: val })}
                placeholder="Buyer Business Name"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>GSTIN</Text>
              <TextInput
                style={styles.input}
                value={customer.gstin}
                onChangeText={handleGstinChange}
                placeholder="27..."
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={[styles.row, { marginTop: 8 }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Place of Supply (State)</Text>
              <TextInput
                style={styles.input}
                value={`${customer.stateName} (${customer.stateCode})`}
                onChangeText={(val) => {
                  const code = val.replace(/\D/g, '').slice(0, 2);
                  setCustomer({ ...customer, stateCode: code || '27' });
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tax Type</Text>
              <View
                style={[
                  styles.taxTypeBadge,
                  isInterState ? styles.badgeIgst : styles.badgeCgst,
                ]}
              >
                <Text
                  style={[
                    styles.taxTypeBadgeText,
                    isInterState ? styles.textIgst : styles.textCgst,
                  ]}
                >
                  {isInterState ? 'INTER-STATE (IGST)' : 'INTRA-STATE (CGST + SGST)'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Billing Address</Text>
            <TextInput
              style={[styles.input, { height: 44 }]}
              value={customer.billingAddress}
              onChangeText={(val) =>
                setCustomer({ ...customer, billingAddress: val })
              }
              multiline
            />
          </View>
        </View>

        {/* Line Items List */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithAction}>
            <Text style={styles.sectionHeading}>
              Line Items ({items.length})
            </Text>
            <TouchableOpacity
              style={styles.addItemBtn}
              onPress={handleOpenAddModal}
            >
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, idx) => (
            <View key={item.id} style={styles.itemRowCard}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemTitle}>
                  {idx + 1}. {item.name}
                </Text>
                <View style={styles.itemActionGroup}>
                  <TouchableOpacity onPress={() => handleEditItem(item)}>
                    <Text style={styles.editActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item.id)}
                    style={{ marginLeft: 12 }}
                  >
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.itemSubDetail}>
                HSN: {item.hsnCode || 'N/A'} • {item.quantity} {item.unit} @ ₹
                {item.unitPrice.toFixed(2)}
                {item.discountPercent > 0 ? ` (${item.discountPercent}% off)` : ''}
              </Text>

              <View style={styles.itemPriceSplit}>
                <Text style={styles.splitTaxable}>
                  Taxable: ₹{item.taxableAmount.toFixed(2)}
                </Text>
                <Text style={styles.splitGst}>
                  GST ({item.taxRate}%): ₹
                  {(isInterState
                    ? item.igstAmount
                    : item.cgstAmount + item.sgstAmount
                  ).toFixed(2)}
                </Text>
                <Text style={styles.splitTotal}>
                  Total: ₹{item.totalAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* GST Calculation & Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionHeading}>Tax Breakdown & Totals</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Taxable Amount</Text>
            <Text style={styles.summaryValue}>₹{taxableSubtotal.toFixed(2)}</Text>
          </View>

          {!isInterState ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Central GST (CGST)</Text>
                <Text style={styles.summaryValue}>₹{totalCgst.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>State GST (SGST)</Text>
                <Text style={styles.summaryValue}>₹{totalSgst.toFixed(2)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Integrated GST (IGST)</Text>
              <Text style={styles.summaryValue}>₹{totalIgst.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Round Off</Text>
            <Text style={styles.summaryValue}>
              {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total (INR)</Text>
            <Text style={styles.grandTotalValue}>
              ₹{roundedGrandTotal.toLocaleString('en-IN')}.00
            </Text>
          </View>
        </View>

        {/* Notes & Terms */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Notes & Declaration</Text>
          <TextInput
            style={[styles.input, { height: 60 }]}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotalBox}>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalNumber}>
            ₹{roundedGrandTotal.toLocaleString('en-IN')}.00
          </Text>
        </View>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmitInvoice}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>Generate Invoice</Text>
        </TouchableOpacity>
      </View>

      {/* Item Modal Form */}
      <Modal
        visible={isItemModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsItemModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem.id && items.some((i) => i.id === editingItem.id)
                ? 'Edit Line Item'
                : 'Add Line Item'}
            </Text>

            <ScrollView>
              <Text style={styles.label}>Product / Item Name *</Text>
              <TextInput
                style={styles.input}
                value={editingItem.name}
                onChangeText={(val) =>
                  setEditingItem({ ...editingItem, name: val })
                }
                placeholder="e.g. Copper Wire Coil"
              />

              <View style={[styles.row, { marginTop: 10 }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>HSN / SAC Code</Text>
                  <TextInput
                    style={styles.input}
                    value={editingItem.hsnCode}
                    onChangeText={(val) =>
                      setEditingItem({ ...editingItem, hsnCode: val })
                    }
                    placeholder="e.g. 7408"
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    value={editingItem.unit}
                    onChangeText={(val) =>
                      setEditingItem({ ...editingItem, unit: val.toUpperCase() })
                    }
                    placeholder="PCS, BOX, KG"
                  />
                </View>
              </View>

              <View style={[styles.row, { marginTop: 10 }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    value={editingItem.quantity.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setEditingItem({
                        ...editingItem,
                        quantity: parseFloat(val) || 0,
                      })
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit Price (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={editingItem.unitPrice.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setEditingItem({
                        ...editingItem,
                        unitPrice: parseFloat(val) || 0,
                      })
                    }
                  />
                </View>
              </View>

              <View style={[styles.row, { marginTop: 10 }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Discount %</Text>
                  <TextInput
                    style={styles.input}
                    value={editingItem.discountPercent.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      setEditingItem({
                        ...editingItem,
                        discountPercent: parseFloat(val) || 0,
                      })
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>GST Rate %</Text>
                  <View style={styles.taxPillRow}>
                    {TAX_RATES.map((rate) => (
                      <TouchableOpacity
                        key={rate}
                        style={[
                          styles.taxPill,
                          editingItem.taxRate === rate && styles.taxPillActive,
                        ]}
                        onPress={() =>
                          setEditingItem({ ...editingItem, taxRate: rate })
                        }
                      >
                        <Text
                          style={[
                            styles.taxPillText,
                            editingItem.taxRate === rate &&
                              styles.taxPillTextActive,
                          ]}
                        >
                          {rate}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsItemModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveModalItem}
              >
                <Text style={styles.modalSaveText}>Save Item</Text>
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
  saveDraftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  saveDraftText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  disabledInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
  },
  disabledText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  taxTypeBadge: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCgst: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeIgst: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  taxTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textCgst: {
    color: '#065F46',
  },
  textIgst: {
    color: '#3730A3',
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addItemBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemBtnText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '700',
  },
  itemRowCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  itemActionGroup: {
    flexDirection: 'row',
  },
  editActionText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  deleteActionText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  itemSubDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  itemPriceSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  splitTaxable: {
    fontSize: 11,
    color: '#475569',
  },
  splitGst: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '600',
  },
  splitTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomTotalBox: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  bottomTotalNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  taxPillRow: {
    flexDirection: 'row',
    gap: 4,
  },
  taxPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 8,
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
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default InvoiceCreateScreen;


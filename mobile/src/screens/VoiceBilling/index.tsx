import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useAppStore } from '../../store/useAppStore';

export interface ParsedItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number; // e.g. 18 for 18%
  hsnCode?: string;
  total: number;
}

type RecordingState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'PARSED';

const SAMPLE_VOICE_COMMANDS = [
  '5 bags UltraTech Cement at 380 each with 28 percent GST',
  '12 pieces Havells 10A Switch at 140 each',
  '2 cans Berger Enamel Paint 4L at 850',
];

export const VoiceBillingScreen: React.FC<{ navigation?: any; route?: any }> = ({
  navigation,
}) => {
  const { business } = useAppStore();
  const [recordingState, setRecordingState] = useState<RecordingState>('IDLE');
  const [transcript, setTranscript] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Om Hardware & Electricals');
  const [customerGstin, setCustomerGstin] = useState<string>('27AACCG1122D1Z8');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([
    {
      id: 'item_1',
      name: 'UltraTech Super Cement (50kg)',
      quantity: 5,
      unit: 'BAG',
      unitPrice: 380,
      taxRate: 28,
      hsnCode: '252329',
      total: 5 * 380 * 1.28,
    },
    {
      id: 'item_2',
      name: 'Havells Modular Switch 10A',
      quantity: 12,
      unit: 'PCS',
      unitPrice: 140,
      taxRate: 18,
      hsnCode: '853650',
      total: 12 * 140 * 1.18,
    },
  ]);

  // Pulse animation for recording state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (recordingState === 'LISTENING') {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      pulseLoop?.stop();
    };
  }, [recordingState, pulseAnim]);

  const handleToggleRecord = () => {
    if (recordingState === 'IDLE' || recordingState === 'PARSED') {
      setRecordingState('LISTENING');
      setTranscript('Listening... Speak your bill items clearly.');

      // Simulate live recognition delay
      setTimeout(() => {
        setTranscript(
          'Add 10 cans Berger Interior Emulsion at 920 each and 4 boxes dry screws at 150'
        );
      }, 2200);

      // Simulate automatic processing after 4.5 seconds
      setTimeout(() => {
        setRecordingState('PROCESSING');
        setTimeout(() => {
          // Append mock parsed results
          const newItems: ParsedItem[] = [
            ...parsedItems,
            {
              id: `item_${Date.now()}_1`,
              name: 'Berger Interior Emulsion (4L)',
              quantity: 10,
              unit: 'CAN',
              unitPrice: 920,
              taxRate: 18,
              hsnCode: '320910',
              total: 10 * 920 * 1.18,
            },
            {
              id: `item_${Date.now()}_2`,
              name: 'Drywall Screws (Box of 500)',
              quantity: 4,
              unit: 'BOX',
              unitPrice: 150,
              taxRate: 18,
              hsnCode: '731815',
              total: 4 * 150 * 1.18,
            },
          ];
          setParsedItems(newItems);
          setRecordingState('PARSED');
        }, 1500);
      }, 4500);
    } else if (recordingState === 'LISTENING') {
      setRecordingState('PROCESSING');
      setTimeout(() => {
        setRecordingState('PARSED');
      }, 1000);
    }
  };

  const handleUpdateItem = (
    id: string,
    field: 'quantity' | 'unitPrice' | 'taxRate' | 'name',
    value: string
  ) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        let numVal = parseFloat(value) || 0;
        let updated = { ...item };

        if (field === 'quantity') updated.quantity = numVal;
        if (field === 'unitPrice') updated.unitPrice = numVal;
        if (field === 'taxRate') updated.taxRate = numVal;
        if (field === 'name') updated.name = value;

        const subtotal = updated.quantity * updated.unitPrice;
        const tax = subtotal * (updated.taxRate / 100);
        updated.total = subtotal + tax;

        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const calculateSubtotal = () =>
    parsedItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

  const calculateTax = () =>
    parsedItems.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice * (it.taxRate / 100),
      0
    );

  const calculateGrandTotal = () => calculateSubtotal() + calculateTax();

  const handleProceedToInvoice = () => {
    if (parsedItems.length === 0) {
      Alert.alert('Empty Bill', 'Please speak or add at least one item before continuing.');
      return;
    }

    if (navigation?.navigate) {
      navigation.navigate('InvoiceCreate', {
        initialCustomer: {
          name: customerName,
          gstin: customerGstin,
        },
        initialItems: parsedItems,
      });
    } else {
      Alert.alert(
        'Voice Draft Ready',
        `Invoice parsed with ${parsedItems.length} items totaling ₹${calculateGrandTotal().toFixed(2)}. Proceeding to final invoice form.`
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>AI Voice Billing</Text>
          <Text style={styles.screenSub}>
            Speak in Hindi, English, or Hinglish to parse line items
          </Text>
        </View>
        <View style={styles.sellerBadge}>
          <Text style={styles.sellerState}>{business?.stateName || 'State: 27'}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Customer Quick Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>Customer / Party Name</Text>
              <TextInput
                style={styles.textInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter Customer Name"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>GSTIN (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={customerGstin}
                onChangeText={setCustomerGstin}
                placeholder="e.g. 27AABCA..."
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        {/* Microphone Section */}
        <View style={styles.voiceSection}>
          <Animated.View
            style={[
              styles.micRing,
              {
                transform: [{ scale: pulseAnim }],
                borderColor:
                  recordingState === 'LISTENING'
                    ? '#EF4444'
                    : recordingState === 'PROCESSING'
                    ? '#3B82F6'
                    : '#E5E7EB',
                backgroundColor:
                  recordingState === 'LISTENING'
                    ? '#FEE2E2'
                    : recordingState === 'PROCESSING'
                    ? '#DBEAFE'
                    : '#F9FAFB',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.micButton,
                {
                  backgroundColor:
                    recordingState === 'LISTENING'
                      ? '#DC2626'
                      : recordingState === 'PROCESSING'
                      ? '#2563EB'
                      : '#1E293B',
                },
              ]}
              onPress={handleToggleRecord}
              activeOpacity={0.8}
            >
              {recordingState === 'PROCESSING' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.micIconText}>
                  {recordingState === 'LISTENING' ? '⏹' : '🎤'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.recordStateText}>
            {recordingState === 'IDLE' && 'Tap mic to start speaking items'}
            {recordingState === 'LISTENING' && 'Listening... Tap to process'}
            {recordingState === 'PROCESSING' && 'AI Parsing speech with HSN & GST rates...'}
            {recordingState === 'PARSED' && 'Items Parsed! Review and edit below'}
          </Text>

          {transcript ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Live Transcript:</Text>
              <Text style={styles.transcriptText}>"{transcript}"</Text>
            </View>
          ) : null}

          {/* Sample Prompts */}
          <View style={styles.hintsContainer}>
            <Text style={styles.hintsTitle}>Try saying:</Text>
            {SAMPLE_VOICE_COMMANDS.map((cmd, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setTranscript(cmd);
                  setRecordingState('PARSED');
                }}
              >
                <Text style={styles.hintChip}>• "{cmd}"</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Parsed Items List */}
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.sectionTitle}>
              Parsed Items ({parsedItems.length})
            </Text>
            <TouchableOpacity
              onPress={() =>
                setParsedItems([
                  ...parsedItems,
                  {
                    id: `item_${Date.now()}`,
                    name: 'New Custom Item',
                    quantity: 1,
                    unit: 'PCS',
                    unitPrice: 100,
                    taxRate: 18,
                    total: 118,
                  },
                ])
              }
            >
              <Text style={styles.addItemText}>+ Add Manual</Text>
            </TouchableOpacity>
          </View>

          {parsedItems.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemIndex}>#{index + 1}</Text>
                <TextInput
                  style={styles.itemNameInput}
                  value={item.name}
                  onChangeText={(val) => handleUpdateItem(item.id, 'name', val)}
                  placeholder="Item Name"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveItem(item.id)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemMetaInputs}>
                <View style={styles.colInput}>
                  <Text style={styles.colLabel}>Qty</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={item.quantity.toString()}
                    onChangeText={(val) => handleUpdateItem(item.id, 'quantity', val)}
                  />
                </View>

                <View style={styles.colInput}>
                  <Text style={styles.colLabel}>Rate (₹)</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={item.unitPrice.toString()}
                    onChangeText={(val) => handleUpdateItem(item.id, 'unitPrice', val)}
                  />
                </View>

                <View style={styles.colInput}>
                  <Text style={styles.colLabel}>GST %</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={item.taxRate.toString()}
                    onChangeText={(val) => handleUpdateItem(item.id, 'taxRate', val)}
                  />
                </View>

                <View style={styles.colTotal}>
                  <Text style={styles.colLabel}>Total</Text>
                  <Text style={styles.colTotalValue}>
                    ₹{item.total.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Bill Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Summary Preview</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxable Amount</Text>
            <Text style={styles.summaryVal}>₹{calculateSubtotal().toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated GST</Text>
            <Text style={styles.summaryVal}>₹{calculateTax().toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalVal}>
              ₹{calculateGrandTotal().toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleProceedToInvoice}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>
            Confirm & Open in Invoice Editor →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sellerBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sellerState: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  voiceSection: {
    alignItems: 'center',
    marginVertical: 10,
  },
  micRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  micIconText: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  recordStateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 10,
    textAlign: 'center',
  },
  transcriptBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  transcriptText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#1E293B',
    marginTop: 4,
  },
  hintsContainer: {
    marginTop: 12,
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hintsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  hintChip: {
    fontSize: 12,
    color: '#2563EB',
    paddingVertical: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addItemText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  itemNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingVertical: 2,
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteBtnText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '700',
  },
  itemMetaInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colInput: {
    flex: 1,
    marginRight: 6,
  },
  colLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
  },
  colTotal: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  colTotalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  grandTotalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  grandTotalVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16A34A',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  confirmBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default VoiceBillingScreen;


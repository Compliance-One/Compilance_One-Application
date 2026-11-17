import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { CONFIG } from '../../config/env';
import { getDb } from '../../db/schema';
import { listCustomers, listProducts } from '../../db/repositories';
import { formatINR } from '../../lib/format';
import { parseDecimal, sanitizeDecimalInput } from '../../lib/numberInput';
import { Screen } from '../../ui';
import { calculateInvoiceTotals, normalizeStateCode, stateCodeFromGstin } from '../../lib/gst';
import { parseTranscript, type CatalogCustomer, type CatalogProduct, type ParsedVoiceItem } from '../../voice/parseTranscript';
import { useSpeechToText, type SpeechLocale } from '../../voice/useSpeechToText';

export interface ParsedItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  hsnCode?: string;
  productId?: string;
  total: number;
  /** Raw text in the number boxes, so "2." and "0.5" can be typed. */
  qtyText?: string;
  priceText?: string;
}

function localeFromApp(voiceLanguage?: string | null, i18nLang?: string): SpeechLocale {
  const raw = (voiceLanguage || i18nLang || 'en').toLowerCase();
  return raw.startsWith('ta') ? 'ta-IN' : 'en-IN';
}

function itemsFromParsed(parsed: ParsedVoiceItem[]): ParsedItem[] {
  return parsed.map((it, idx) => ({
    id: it.productId || `voice_${idx}_${it.name}`,
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice ?? 0,
    taxRate: it.taxRate ?? 0,
    hsnCode: it.hsnCode,
    productId: it.productId,
    total: (it.unitPrice ?? 0) * it.quantity,
  }));
}

export const VoiceBillingScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { business } = useAppStore();
  const sellerStateCode = business?.stateCode || CONFIG.DEFAULT_STATE_CODE;
  const [lang, setLang] = useState<SpeechLocale>(() => localeFromApp(undefined, i18n.language));
  const speech = useSpeechToText(lang);

  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [customers, setCustomers] = useState<CatalogCustomer[]>([]);
  const [editedTranscript, setEditedTranscript] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      if (!business?.id) return;
      void (async () => {
        const db = await getDb();
        const [prods, custs] = await Promise.all([listProducts(db, business.id), listCustomers(db, business.id)]);
        setProducts(prods);
        setCustomers(custs);
      })();
    }, [business?.id])
  );

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (speech.state === 'listening') {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoop?.stop();
    };
  }, [speech.state, pulseAnim]);

  const applyTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const bill = parseTranscript(text, { products, customers });
      if (bill.customerName) {
        setCustomerName(bill.customerName);
        setCustomerId(bill.customer?.id);
        if (bill.customer?.gstin) setCustomerGstin(bill.customer.gstin);
      }
      if (bill.items.length) setParsedItems(itemsFromParsed(bill.items));
    },
    [products, customers]
  );

  useEffect(() => {
    if (speech.display) setEditedTranscript(speech.display);
    if (speech.transcript) applyTranscript(speech.transcript);
  }, [speech.display, speech.transcript, applyTranscript]);

  const handleUpdateItem = (id: string, field: 'quantity' | 'unitPrice' | 'taxRate' | 'name', value: string) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };
        if (field === 'quantity') {
          updated.qtyText = sanitizeDecimalInput(value, 3);
          updated.quantity = parseDecimal(updated.qtyText);
        }
        if (field === 'unitPrice') {
          updated.priceText = sanitizeDecimalInput(value, 2);
          updated.unitPrice = parseDecimal(updated.priceText);
        }
        if (field === 'taxRate') updated.taxRate = parseDecimal(sanitizeDecimalInput(value, 2));
        if (field === 'name') updated.name = value;
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      })
    );
  };

  const buyerStateCode =
    stateCodeFromGstin(customerGstin) ||
    (customers.find((c) => c.id === customerId)?.stateCode ?? '') ||
    normalizeStateCode(sellerStateCode) ||
    CONFIG.DEFAULT_STATE_CODE;

  const gstSummary = calculateInvoiceTotals(
    parsedItems.map((it) => ({ unitPrice: it.unitPrice, quantity: it.quantity, taxRate: it.taxRate })),
    sellerStateCode,
    buyerStateCode
  );

  const handleProceedToInvoice = () => {
    if (parsedItems.length === 0) {
      Alert.alert(t('voiceBilling.empty'));
      return;
    }
    navigation?.navigate?.('InvoiceCreate', {
      initialCustomer: {
        id: customerId,
        name: customerName,
        gstin: customerGstin,
        stateCode: buyerStateCode,
      },
      initialItems: parsedItems.map(({ qtyText: _q, priceText: _p, ...rest }) => rest),
      inputMode: 'voice',
    });
  };

  const listening = speech.state === 'listening' || speech.state === 'requesting';

  return (
    <Screen edges={['bottom']} scroll={false} style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>{t('voiceBilling.title')}</Text>
          <Text style={styles.screenSub}>
            {speech.onDevice ? t('voiceBilling.onDevice') : t('voiceBilling.platformStt')}
          </Text>
        </View>
        <View style={styles.sellerBadge}>
          <Text style={styles.sellerState}>{t('voiceBilling.stateLabel', { code: sellerStateCode })}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {speech.mocked ? (
          <View style={styles.mockBanner}>
            <Text style={styles.mockText}>{t('voiceBilling.mockMode')}</Text>
          </View>
        ) : null}

        <View style={styles.langRow}>
          {(['en-IN', 'ta-IN'] as SpeechLocale[]).map((code) => {
            const on = lang === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.langChip, on && styles.langChipOn]}
                onPress={() => setLang(code)}
              >
                <Text style={[styles.langChipText, on && styles.langChipTextOn]}>
                  {code === 'ta-IN' ? t('settings.tamil') : t('settings.english')} ({code})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('voiceBilling.customer')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder={t('voiceBilling.customerName')}
              value={customerName}
              onChangeText={(v) => {
                setCustomerName(v);
                setCustomerId(undefined);
              }}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="GSTIN"
              autoCapitalize="characters"
              value={customerGstin}
              onChangeText={setCustomerGstin}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('voiceBilling.transcript')}</Text>
          {speech.error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{speech.error}</Text>
            </View>
          ) : null}
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.micButton}
                onPress={() => void (listening ? speech.stop() : speech.start())}
                activeOpacity={0.85}
              >
                {speech.state === 'requesting' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.micButtonText}>
                    {listening ? t('voiceBilling.stop') : t('voiceBilling.listen')}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
            {listening ? (
              <TouchableOpacity onPress={() => void speech.cancel()} style={{ marginTop: 8 }}>
                <Text style={styles.hint}>{t('voiceBilling.cancel')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            multiline
            value={editedTranscript}
            onChangeText={(text) => {
              setEditedTranscript(text);
              applyTranscript(text);
            }}
            placeholder={t('voiceBilling.transcriptHint')}
          />
          <Text style={styles.hint}>{t('voiceBilling.editHint')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('voiceBilling.items')}</Text>
          {parsedItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={item.name}
                onChangeText={(val) => handleUpdateItem(item.id, 'name', val)}
              />
              <TextInput
                style={[styles.input, { flex: 0.7, marginLeft: 6 }]}
                keyboardType="decimal-pad"
                value={item.qtyText ?? String(item.quantity)}
                onChangeText={(val) => handleUpdateItem(item.id, 'quantity', val)}
              />
              <TextInput
                style={[styles.input, { flex: 0.9, marginLeft: 6 }]}
                keyboardType="decimal-pad"
                value={item.priceText ?? String(item.unitPrice)}
                onChangeText={(val) => handleUpdateItem(item.id, 'unitPrice', val)}
              />
              <TouchableOpacity onPress={() => setParsedItems((prev) => prev.filter((it) => it.id !== item.id))}>
                <Text style={styles.hint}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('voiceBilling.taxable')}</Text>
            <Text style={styles.summaryVal}>{formatINR(gstSummary.summary.totalTaxableAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('voiceBilling.tax')}</Text>
            <Text style={styles.summaryVal}>{formatINR(gstSummary.summary.totalTaxAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('voiceBilling.total')}</Text>
            <Text style={styles.grandTotalVal}>{formatINR(gstSummary.summary.grandTotal)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleProceedToInvoice} activeOpacity={0.85}>
          <Text style={styles.confirmBtnText}>{t('voiceBilling.proceed')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
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
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  langChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langChipOn: { backgroundColor: '#4338CA', borderColor: '#4338CA' },
  langChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  langChipTextOn: { color: '#FFFFFF' },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  mockBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  mockText: { color: '#92400E', fontSize: 12 },
  hint: { fontSize: 12, color: '#64748B', marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  micButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});

export default VoiceBillingScreen;
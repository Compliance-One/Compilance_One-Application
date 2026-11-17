/**
 * Structured voice billing: speak → items appear as editable cards → Save.
 * "2 kilo arisi 60 rupees, 1 sugar 45" or "rendu kilo arisi aruvathu rupai".
 * Each new phrase is appended, so the owner can keep speaking to add more.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { CONFIG } from '../../config/env';
import { getDb } from '../../db/schema';
import { createInvoice, listCustomers, listProducts, nextInvoiceNumber } from '../../db/repositories';
import { formatINR } from '../../lib/format';
import { localISODate } from '../../lib/dates';
import { calculateInvoiceTotals, isValidGstin, normalizeStateCode, stateCodeFromGstin, stateNameFor } from '../../lib/gst';
import { SEED_ALIASES } from '../../data/hardwareCatalog';
import { numberToInput, parseDecimal, sanitizeDecimalInput } from '../../lib/numberInput';
import { alertActionError, printInvoiceById, shareInvoicePdfById } from '../../billing/invoiceActions';
import { parseTranscript, type CatalogCustomer, type CatalogProduct, type ParsedVoiceItem } from '../../voice/parseTranscript';
import { useSpeechToText, type SpeechLocale } from '../../voice/useSpeechToText';
import { BigButton, font, Panel, rad, Screen, sp, TextField, TOUCH, ui } from '../../ui';

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
  qtyText?: string;
  priceText?: string;
}

let seq = 0;
function itemsFromParsed(parsed: ParsedVoiceItem[]): ParsedItem[] {
  return parsed.map((it) => {
    seq += 1;
    const price = it.unitPrice ?? 0;
    return {
      id: `voice_${Date.now()}_${seq}`,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: price,
      taxRate: it.taxRate ?? 0,
      hsnCode: it.hsnCode,
      productId: it.productId,
      total: price * it.quantity,
      qtyText: numberToInput(it.quantity),
      priceText: price ? numberToInput(price) : '',
    };
  });
}

export const VoiceBillingScreen: React.FC<{ navigation?: any; route?: any }> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const business = useAppStore((s) => s.business);
  const sellerStateCode = normalizeStateCode(business?.stateCode) || CONFIG.DEFAULT_STATE_CODE;
  const [lang, setLang] = useState<SpeechLocale>(i18n.language.startsWith('ta') ? 'ta-IN' : 'en-IN');
  const speech = useSpeechToText(lang);

  const [customerName, setCustomerName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [picked, setPicked] = useState<CatalogCustomer | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [customers, setCustomers] = useState<CatalogCustomer[]>([]);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!business?.id) return;
      void (async () => {
        const db = await getDb();
        const [prods, custs] = await Promise.all([listProducts(db, business.id), listCustomers(db, business.id)]);
        // Seeded items carry Tamil/Tanglish names so "aani" finds "Wire Nails".
        setProducts(prods.map((p) => ({ ...p, aliases: SEED_ALIASES[p.name.toLowerCase()] })));
        setCustomers(custs);
      })();
    }, [business?.id])
  );

  const addFromText = useCallback(
    (text: string) => {
      if (!text.trim()) return 0;
      const bill = parseTranscript(text, { products, customers });
      if (bill.customerName && !customerName) setCustomerName(bill.customerName);
      const next = itemsFromParsed(bill.items);
      if (next.length) setItems((prev) => [...prev, ...next]);
      return next.length;
    },
    [products, customers, customerName]
  );

  // Each committed final phrase is parsed and appended exactly once.
  const lastId = useRef(0);
  useEffect(() => {
    if (speech.committed.id === 0 || speech.committed.id === lastId.current) return;
    lastId.current = speech.committed.id;
    addFromText(speech.committed.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.committed.id]);

  const update = (id: string, patch: Partial<ParsedItem>) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const u = { ...it, ...patch };
        u.total = u.quantity * u.unitPrice;
        return u;
      })
    );

  const gstinClean = custGstin.trim().toUpperCase();
  const gstinError = gstinClean.length > 0 && !isValidGstin(gstinClean);
  const buyerStateCode =
    (gstinClean && !gstinError ? stateCodeFromGstin(gstinClean) : '') ||
    normalizeStateCode(picked?.stateCode) ||
    sellerStateCode;
  const totals = calculateInvoiceTotals(
    items.map((it) => ({ unitPrice: it.unitPrice, quantity: it.quantity, taxRate: it.taxRate })),
    sellerStateCode,
    buyerStateCode
  ).summary;

  const q = customerName.trim().toLowerCase();
  const suggestions =
    q.length >= 1 && !picked
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)).slice(0, 4)
      : [];
  const pickCustomer = (c: CatalogCustomer) => {
    setPicked(c);
    setCustomerName(c.name);
    setCustPhone(c.phone ?? '');
    setCustGstin(c.gstin ?? '');
  };
  const clearCustomer = () => {
    setPicked(null);
    setCustomerName('');
    setCustPhone('');
    setCustGstin('');
  };

  const listening = speech.state === 'listening' || speech.state === 'requesting';

  async function save() {
    if (savingRef.current) return;
    if (!business?.id) {
      Alert.alert(t('invoiceCreate.missingBusiness'));
      return;
    }
    const valid = items.filter((it) => it.name.trim() && it.quantity > 0);
    if (valid.length === 0) {
      Alert.alert(t('voiceBilling.empty'));
      return;
    }
    if (valid.some((it) => it.unitPrice <= 0)) {
      Alert.alert(t('voiceBilling.priceMissing'));
      return;
    }
    if (gstinError) {
      Alert.alert(t('voiceBilling.gstinBadTitle'), t('voiceBilling.gstinBad'));
      return;
    }
    if (gstinClean && !customerName.trim()) {
      Alert.alert(t('voiceBilling.gstinNeedsName'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      if (listening) await speech.cancel();
      const db = await getDb();
      const number = await nextInvoiceNumber(db, business.id);
      const name = customerName.trim();
      const match = picked ?? customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const newItems = valid.filter((it) => !it.productId).length;
      const id = await createInvoice(db, {
        businessId: business.id,
        sellerStateCode,
        buyerStateCode,
        invoiceNumber: number,
        invoiceDate: localISODate(),
        inputMode: 'voice',
        customer: name
          ? {
              id: match?.id,
              name,
              phone: custPhone.trim() || undefined,
              gstin: gstinClean || undefined,
              stateCode: buyerStateCode,
            }
          : null,
        items: valid.map((it) => ({
          name: it.name.trim(),
          hsnCode: it.hsnCode,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          productId: it.productId,
        })),
      });
      const total = totals.grandTotal;
      setItems([]);
      clearCustomer();
      setTyped('');
      // Reload so items created from this bill are matched next time.
      const [prods, custs] = await Promise.all([listProducts(db, business.id), listCustomers(db, business.id)]);
      setProducts(prods.map((p) => ({ ...p, aliases: SEED_ALIASES[p.name.toLowerCase()] })));
      setCustomers(custs);
      const body =
        t('invoiceCreate.createdBody', { number, amount: formatINR(total) }) +
        (newItems > 0 ? '\n' + t('voiceBilling.newItemsAdded', { count: newItems }) : '');
      Alert.alert(t('invoiceCreate.created'), body, [
        { text: t('invoiceCreate.print'), onPress: () => void printInvoiceById(id).catch((e) => alertActionError(e, 'Print')) },
        { text: t('invoiceCreate.sharePdf'), onPress: () => void shareInvoicePdfById(id).catch((e) => alertActionError(e, 'PDF')) },
        { text: t('common.ok', { defaultValue: 'OK' }) },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[font.small, { color: ui.textSoft }]}>{t('voiceBilling.total')}</Text>
            <Text style={[font.moneyBig, { color: ui.text }]}>{formatINR(totals.grandTotal)}</Text>
          </View>
          <BigButton
            label={t('voiceBilling.saveBill')}
            icon="✅"
            variant="good"
            onPress={() => void save()}
            busy={saving}
            disabled={items.length === 0}
            style={{ flex: 1.2 }}
          />
        </View>
      }
    >
      <View style={s.langRow}>
        {(['ta-IN', 'en-IN'] as SpeechLocale[]).map((code) => {
          const on = lang === code;
          return (
            <Pressable key={code} onPress={() => setLang(code)} style={[s.chip, on && s.chipOn]}>
              <Text style={[font.bodyStrong, { color: on ? ui.onDark : ui.primary }]}>
                {code === 'ta-IN' ? 'தமிழ்' : 'English'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Panel style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => void (listening ? speech.stop() : speech.start())}
          accessibilityRole="button"
          style={({ pressed }) => [s.mic, listening && s.micOn, pressed && { opacity: 0.85 }]}
        >
          <Text style={{ fontSize: 44 }}>{listening ? '⏹' : '🎤'}</Text>
        </Pressable>
        <Text style={[font.heading, { color: ui.primary, textAlign: 'center' }]}>
          {listening ? t('voiceBilling.listening') : items.length ? t('voiceBilling.speakMore') : t('voiceBilling.tapToSpeak')}
        </Text>
        <Text style={[font.small, { color: ui.textSoft, textAlign: 'center' }]}>{t('voiceBilling.example')}</Text>
        {speech.display ? (
          <Text style={[font.body, { color: ui.text, textAlign: 'center', fontStyle: 'italic' }]}>“{speech.display}”</Text>
        ) : null}
        {speech.error ? (
          <View style={s.error}>
            <Text style={[font.body, { color: ui.danger }]}>{speech.error}</Text>
          </View>
        ) : null}
      </Panel>

      <View style={{ flexDirection: 'row', gap: sp.sm, alignItems: 'center' }}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder={t('voiceBilling.typeHint')}
          placeholderTextColor={ui.textFaint}
          style={s.typeBox}
          onSubmitEditing={() => {
            if (addFromText(typed)) setTyped('');
          }}
          returnKeyType="done"
        />
        <BigButton label="+" compact onPress={() => (addFromText(typed) ? setTyped('') : undefined)} style={{ width: TOUCH + 8 }} />
      </View>

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[font.bodyStrong, { color: ui.text, flex: 1 }]}>👤 {t('voiceBilling.customerOptional')}</Text>
          {customerName || custPhone || custGstin ? (
            <Pressable onPress={clearCustomer} hitSlop={10}>
              <Text style={[font.small, { color: ui.danger }]}>{t('voiceBilling.clearCustomer')}</Text>
            </Pressable>
          ) : null}
        </View>
        <TextField
          label={t('voiceBilling.customerName')}
          value={customerName}
          onChangeText={(v) => {
            setCustomerName(v);
            if (picked && v.trim().toLowerCase() !== picked.name.toLowerCase()) setPicked(null);
          }}
          placeholder={t('voiceBilling.walkIn')}
        />
        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
            {suggestions.map((c) => (
              <Pressable key={c.id} onPress={() => pickCustomer(c)} style={s.chip}>
                <Text style={[font.small, { color: ui.primary }]}>
                  {c.name}
                  {c.gstin ? ' · GST' : c.phone ? ` · ${c.phone}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextField
          label={t('voiceBilling.customerPhone')}
          value={custPhone}
          onChangeText={(v) => setCustPhone(v.replace(/[^0-9+ ]/g, ''))}
          keyboardType="phone-pad"
          maxLength={15}
        />
        <TextField
          label={t('voiceBilling.customerGstin')}
          value={custGstin}
          onChangeText={(v) => setCustGstin(v.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
          autoCapitalize="characters"
          maxLength={15}
          placeholder="33ABCDE1234F1Z5"
        />
        {gstinError ? (
          <Text style={[font.small, { color: ui.danger }]}>{t('voiceBilling.gstinBad')}</Text>
        ) : gstinClean ? (
          <Text style={[font.small, { color: ui.good }]}>
            {t('voiceBilling.b2bNote', { state: stateNameFor(buyerStateCode) })}
          </Text>
        ) : null}
      </Panel>

      {items.map((it, idx) => (
        <Panel key={it.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
            <Text style={[font.bodyStrong, { color: ui.textFaint }]}>{idx + 1}.</Text>
            <TextInput value={it.name} onChangeText={(v) => update(it.id, { name: v })} style={[s.cell, { flex: 1, fontWeight: '700' }]} />
            <Pressable onPress={() => setItems((p) => p.filter((x) => x.id !== it.id))} hitSlop={10} style={s.del}>
              <Text style={{ fontSize: 20, color: ui.danger }}>✕</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: sp.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>{t('voiceBilling.qty')}</Text>
              <TextInput
                value={it.qtyText ?? String(it.quantity)}
                keyboardType="decimal-pad"
                onChangeText={(v) => {
                  const c = sanitizeDecimalInput(v, 3);
                  update(it.id, { qtyText: c, quantity: parseDecimal(c) });
                }}
                style={s.cell}
              />
            </View>
            <View style={{ flex: 0.8 }}>
              <Text style={s.lbl}>{t('voiceBilling.unit')}</Text>
              <TextInput value={it.unit} onChangeText={(v) => update(it.id, { unit: v.toUpperCase() })} style={s.cell} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1.1 }}>
              <Text style={s.lbl}>{t('voiceBilling.rate')}</Text>
              <TextInput
                value={it.priceText ?? String(it.unitPrice)}
                keyboardType="decimal-pad"
                placeholder="₹"
                onChangeText={(v) => {
                  const c = sanitizeDecimalInput(v, 2);
                  update(it.id, { priceText: c, unitPrice: parseDecimal(c) });
                }}
                style={[s.cell, it.unitPrice <= 0 && { borderColor: ui.danger }]}
              />
            </View>
            <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
              <Text style={s.lbl}>{t('voiceBilling.amount')}</Text>
              <Text style={[font.money, { fontSize: 19, color: ui.text }]}>{formatINR(it.total)}</Text>
            </View>
          </View>
          {it.taxRate > 0 || it.hsnCode ? (
            <Text style={[font.small, { color: ui.textSoft }]}>
              {it.hsnCode ? `HSN ${it.hsnCode} • ` : ''}GST {it.taxRate}%{it.productId ? ` • ${t('voiceBilling.fromItems')}` : ''}
            </Text>
          ) : null}
        </Panel>
      ))}

      {items.length > 0 && totals.totalTaxAmount > 0 ? (
        <Panel>
          <Row label={t('voiceBilling.taxable')} value={formatINR(totals.totalTaxableAmount)} />
          {totals.isInterState ? (
            <Row label="IGST" value={formatINR(totals.totalIgstAmount)} />
          ) : (
            <>
              <Row label="CGST" value={formatINR(totals.totalCgstAmount)} />
              <Row label="SGST" value={formatINR(totals.totalSgstAmount)} />
            </>
          )}
        </Panel>
      ) : null}

      {items.length > 0 ? (
        <BigButton
          label={t('voiceBilling.proceed')}
          variant="ghost"
          compact
          onPress={() =>
            navigation?.navigate?.('InvoiceCreate', {
              initialCustomer: customerName.trim() ? { name: customerName.trim() } : undefined,
              initialItems: items.map(({ qtyText: _q, priceText: _p, total: _t, ...rest }) => rest),
              inputMode: 'voice',
            })
          }
        />
      ) : null}
    </Screen>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[font.body, { color: ui.textSoft }]}>{label}</Text>
      <Text style={[font.bodyStrong, { color: ui.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  langRow: { flexDirection: 'row', gap: sp.sm },
  chip: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: rad.pill,
    borderWidth: 2,
    borderColor: ui.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: ui.primary },
  mic: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: ui.primaryTint,
    borderWidth: 4,
    borderColor: ui.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.sm,
  },
  micOn: { backgroundColor: ui.dangerTint, borderColor: ui.danger },
  error: { backgroundColor: ui.dangerTint, borderRadius: rad.control, padding: sp.md, marginTop: sp.sm, alignSelf: 'stretch' },
  typeBox: {
    ...font.body,
    flex: 1,
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: rad.control,
    backgroundColor: ui.surface,
    paddingHorizontal: sp.md,
    color: ui.text,
  },
  cell: {
    ...font.body,
    minHeight: 48,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 10,
    paddingHorizontal: sp.sm,
    backgroundColor: ui.bg,
    color: ui.text,
  },
  lbl: { ...font.small, color: ui.textSoft, marginBottom: 2 },
  del: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

export default VoiceBillingScreen;

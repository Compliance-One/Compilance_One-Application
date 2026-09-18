/**
 * VoiceBilling Screen — Premium & Fully Functional
 * - Real on-device Speech-to-Text via @react-native-voice/voice
 * - Tamil, Tanglish, and English locale switching
 * - Dynamic 40-bar visualizer waveform
 * - Quick-bill chips in Tamil / Tanglish / English for 1-tap testing
 * - Interactive keyboard entry with smart Tanglish parser
 * - Live GST item breakdown & navigation to invoice creation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, Animated, Dimensions, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore, LineItem } from '../../store/useAppStore';
import { db } from '../../db/client';
import { products as productsTable } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { Product } from '../../db/schema';

// Safe Voice import: uses the real @react-native-voice/voice on dev builds,
// falls back to a no-op shim on Expo Go where the native module is unavailable.
import Voice from '../../voice/voiceClient';

const { width: SW } = Dimensions.get('window');
const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

// ─── Tamil & Tanglish Number Parser ──────────────────────────────────────────
const NUMS_DICT: Record<string, number> = {
  // Tamil script
  'ஒன்று': 1, 'ஒரு': 1, '1': 1,
  'இரண்டு': 2, 'ரெண்டு': 2, '2': 2,
  'மூன்று': 3, 'மூனு': 3, '3': 3,
  'நான்கு': 4, 'நாலு': 4, '4': 4,
  'ஐந்து': 5, 'அஞ்சு': 5, '5': 5,
  'ஆறு': 6, '6': 6,
  'ஏழு': 7, '7': 7,
  'எட்டு': 8, '8': 8,
  'ஒன்பது': 9, '9': 9,
  'பத்து': 10, '10': 10,
  'இருபது': 20, 'முப்பது': 30, 'ஐம்பது': 50, 'நூறு': 100,

  // Tanglish phonetic
  'onnu': 1, 'oru': 1, 'one': 1,
  'rendu': 2, 'irandu': 2, 'two': 2,
  'moonu': 3, 'moondru': 3, 'three': 3,
  'naalu': 4, 'naangu': 4, 'four': 4,
  'anju': 5, 'aindhu': 5, 'five': 5,
  'aaru': 6, 'six': 6,
  'yezhu': 7, 'elu': 7, 'seven': 7,
  'yettu': 8, 'ettu': 8, 'eight': 8,
  'onbadhu': 9, 'onbathu': 9, 'nine': 9,
  'pathu': 10, 'ten': 10,
  'iruvadhu': 20, 'irubadhu': 20, 'twenty': 20,
  'muppadhu': 30, 'thirty': 30,
  'aimbadhu': 50, 'fifty': 50,
  'nooru': 100, 'hundred': 100,
  'aayiram': 1000, 'thousand': 1000,
};

// ─── Inline Demo Catalog (fallback when DB is empty) ──────────────────────────
// Used so Voice Billing always works out-of-the-box even on first launch.
const DEMO_CATALOG: Product[] = [
  { id: 'p1', businessId: 'demo-biz', name: 'Basmati Rice 1kg (அரிசி)',           hsnCode: '1006', gstRate: 5,  unit: 'KG',  price: 120, stockQuantity: 50, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'p2', businessId: 'demo-biz', name: 'Sugar 1kg (சர்க்கரை)',               hsnCode: '1701', gstRate: 5,  unit: 'KG',  price: 45,  stockQuantity: 100, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'p3', businessId: 'demo-biz', name: 'Sunflower Oil 1L (எண்ணெய்)',        hsnCode: '1512', gstRate: 5,  unit: 'LTR', price: 140, stockQuantity: 40, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'p4', businessId: 'demo-biz', name: 'Toor Dal 1kg (துவரம் பருப்பு)',      hsnCode: '0713', gstRate: 0,  unit: 'KG',  price: 160, stockQuantity: 30, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'p5', businessId: 'demo-biz', name: 'Aavin Milk 500ml (பால்)',            hsnCode: '0401', gstRate: 0,  unit: 'PKT', price: 25,  stockQuantity: 60, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'p6', businessId: 'demo-biz', name: 'Tea Powder 250g (தேயிலை)',          hsnCode: '0902', gstRate: 5,  unit: 'PKT', price: 95,  stockQuantity: 45, isActive: true, createdAt: '', updatedAt: '' },
];

// Animated waveform bar
function WaveBar({ active, delay = 0 }: { active: boolean; delay?: number }) {
  const h = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(h, { toValue: 8 + Math.random() * 32, duration: 250 + delay, useNativeDriver: false }),
          Animated.timing(h, { toValue: 4 + Math.random() * 12, duration: 250 + delay, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(h, { toValue: 8, duration: 200, useNativeDriver: false }).start();
    }
  }, [active]);

  return <Animated.View style={[waveStyles.bar, { height: h }]} />;
}

// Pulsing mic button
function MicButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recording) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulse1, { toValue: 1.5, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse2, { toValue: 2.0, duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulse1, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse2, { toValue: 2.0, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      Animated.parallel([
        Animated.timing(pulse1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [recording]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={micStyles.wrap}>
      <Animated.View style={[micStyles.ring2, { transform: [{ scale: pulse2 }], opacity: recording ? 0.15 : 0 }]} />
      <Animated.View style={[micStyles.ring1, { transform: [{ scale: pulse1 }], opacity: recording ? 0.25 : 0 }]} />
      <View style={[micStyles.btn, recording && micStyles.btnActive]}>
        {recording
          ? <View style={micStyles.stopSquare} />
          : <Text style={micStyles.icon}>🎙️</Text>
        }
      </View>
    </TouchableOpacity>
  );
}

export default function VoiceBillingScreen() {
  const router       = useRouter();
  const business     = useAppStore((s) => s.business);
  const setDraft     = useAppStore((s) => s.setDraftLineItems);
  const language     = useAppStore((s) => s.language) || 'ta';

  const [recording,    setRecording]    = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [lineItems,    setLineItems]    = useState<LineItem[]>([]);
  const [inputMode,    setInputMode]    = useState<'voice' | 'keyboard'>('voice');
  const [textInput,    setTextInput]    = useState('');
  const [error,        setError]        = useState<string | null>(null);
  const [catalog,      setCatalog]      = useState<Product[]>([]);
  const isVoiceAvailable = useRef(false);

  // ─── Voice STT Locale based on language ────────────────────────────────────
  const getLocale = () => {
    if (language === 'ta' || language === 'tanglish') return 'ta-IN'; // Tamil India
    return 'en-IN'; // English India
  };

  // ─── Set up @react-native-voice/voice event listeners ──────────────────────
  useEffect(() => {
    if (!Voice || Platform.OS === 'web') return;

    // Check availability
    Voice.isAvailable?.().then((avail: any) => {
      isVoiceAvailable.current = !!avail;
    }).catch(() => {
      isVoiceAvailable.current = false;
    });

    Voice.onSpeechStart    = () => setRecording(true);
    Voice.onSpeechEnd      = () => setRecording(false);
    Voice.onSpeechError    = (e: any) => {
      setRecording(false);
      const code = e?.error?.code ?? e?.code ?? '';
      if (String(code) === '7' || String(code).includes('7')) {
        setError(language === 'ta'
          ? 'பேச்சு கேட்கவில்லை. மீண்டும் முயற்சிக்கவும்.'
          : language === 'tanglish'
          ? 'Speech ketkavillai. Marubadiyum try pannavum.'
          : 'No speech detected. Please try again.');
      } else {
        setError(language === 'ta' ? 'பிழை: ' + (e?.error?.message ?? '') : 'Error: ' + (e?.error?.message ?? String(e)));
      }
    };
    Voice.onSpeechPartialResults = (e: any) => {
      const partial = e?.value?.[0] ?? '';
      if (partial) setTranscript(partial);
    };
    Voice.onSpeechResults = (e: any) => {
      const result = e?.value?.[0] ?? '';
      if (result) {
        setTranscript(result);
        parseUtterance(result);
      }
      setRecording(false);
    };

    return () => {
      Voice?.destroy?.().catch(() => {});
      Voice?.removeAllListeners?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Fetch product catalog — works with or without a logged-in business
  useEffect(() => {
    const bizId = business?.id ?? 'demo-biz';
    // Load from DB first
    db.select().from(productsTable)
      .where(eq(productsTable.businessId, bizId))
      .then((rows: Product[]) => {
        if (rows && rows.length > 0) {
          setCatalog(rows);
        } else {
          // Fall back to inline demo catalog so the screen always works
          setCatalog(DEMO_CATALOG);
        }
      })
      .catch(() => setCatalog(DEMO_CATALOG));
  }, [business]);

  // ─── Tamil & Tanglish Parser Function ───────────────────────────────────────
  const parseUtterance = useCallback((raw: string) => {
    if (!raw.trim()) return;
    setError(null);
    setTranscript(raw);

    // Use whichever catalog is loaded — fall back to DEMO_CATALOG if empty
    const activeCatalog = catalog.length > 0 ? catalog : DEMO_CATALOG;

    // Split on commas, 'and', 'மற்றும்', newlines
    const clauses = raw.split(/[,،፤\n]|\s+மற்றும்\s+|\s+and\s+/i);
    const parsed: LineItem[] = [];

    for (const clause of clauses) {
      const trimmed = clause.trim();
      if (!trimmed) continue;

      const words = trimmed.split(/\s+/);
      let qty = 1;
      let matchedProd: Product | null = null;
      let explicitRate: number | null = null;

      // Strategy: first standalone integer ≤ 50 = quantity, next standalone integer > 10 = rate
      const nums: number[] = [];
      for (const w of words) {
        const clean = w.replace(/[^\w\u0B80-\u0BFF]/g, '').toLowerCase();
        if (NUMS_DICT[clean] !== undefined) {
          nums.push(NUMS_DICT[clean]);
        } else if (/^\d+$/.test(clean)) {
          nums.push(parseInt(clean, 10));
        }
      }
      if (nums.length >= 2) {
        qty = nums[0];
        explicitRate = nums[1];
      } else if (nums.length === 1) {
        // Single number — if > 20 treat as rate, else qty
        if (nums[0] > 20) explicitRate = nums[0];
        else qty = nums[0];
      }

      // Match product from catalog — Tamil script, Tanglish, English
      const lowerClause = trimmed.toLowerCase();
      for (const p of activeCatalog) {
        const pNameLower = p.name.toLowerCase();
        const baseName   = pNameLower.split(' ')[0];

        const matchRice  = (pNameLower.includes('அரிசி')    || pNameLower.includes('rice'))   && (lowerClause.includes('அரிசி')    || lowerClause.includes('arisi')      || lowerClause.includes('rice'));
        const matchSugar = (pNameLower.includes('சர்க்கரை') || pNameLower.includes('sugar'))  && (lowerClause.includes('சர்க்கரை') || lowerClause.includes('sakkarai')    || lowerClause.includes('sugar'));
        const matchOil   = (pNameLower.includes('எண்ணெய்')  || pNameLower.includes('oil'))    && (lowerClause.includes('எண்ணெய்')  || lowerClause.includes('ennai')       || lowerClause.includes('oil')   || lowerClause.includes('sunflower'));
        const matchMilk  = (pNameLower.includes('பால்')      || pNameLower.includes('milk'))   && (lowerClause.includes('பால்')      || lowerClause.includes('paal')        || lowerClause.includes('milk')  || lowerClause.includes('aavin'));
        const matchDal   = (pNameLower.includes('பருப்பு')   || pNameLower.includes('dal'))    && (lowerClause.includes('பருப்பு')   || lowerClause.includes('paruppu')     || lowerClause.includes('dal')   || lowerClause.includes('dhal')  || lowerClause.includes('toor'));
        const matchTea   = (pNameLower.includes('தேயிலை')   || pNameLower.includes('tea'))    && (lowerClause.includes('தேயிலை')   || lowerClause.includes('theeyilai')   || lowerClause.includes('tea')   || lowerClause.includes('chai'));

        if (matchRice || matchSugar || matchOil || matchMilk || matchDal || matchTea ||
            (baseName.length > 2 && lowerClause.includes(baseName)) ||
            lowerClause.includes(p.hsnCode)) {
          matchedProd = p;
          break;
        }
      }

      const prodName = matchedProd?.name ?? trimmed;
      const rate = explicitRate ?? (matchedProd?.price ?? 100);
      const hsn = matchedProd?.hsnCode ?? '9999';
      const unit = matchedProd?.unit ?? 'NOS';
      const gstRate = matchedProd?.gstRate ?? 5;
      const taxable = rate * qty;
      const tax = (taxable * gstRate) / 100;
      const cgst = tax / 2;
      const sgst = tax / 2;
      const total = taxable + tax;

      parsed.push({
        productId: matchedProd?.id ?? `custom-${Date.now()}-${Math.random()}`,
        productName: prodName,
        hsnCode: hsn,
        quantity: qty,
        unit,
        rate,
        discount: 0,
        taxableAmount: taxable,
        gstRate,
        cgst,
        sgst,
        igst: 0,
        total,
      });
    }

    if (parsed.length > 0) {
      setLineItems(parsed);
    } else {
      setError(
        language === 'ta'
          ? 'பொருட்களை அடையாளம் காண முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
          : (language === 'tanglish'
            ? 'Items identify panna mudiyavillai. Marubadiyum try pannavum.'
            : 'Could not identify items. Please try again.')
      );
    }
  }, [catalog, language]);

  const inputRef = useRef<TextInput>(null);

  const handleRecord = useCallback(async () => {
    setError(null);

    // ── If already recording via native Voice, stop it ─────────────────────────
    if (recording) {
      try { await Voice?.stop?.(); } catch (_e) {}
      setRecording(false);
      return;
    }

    // ── Native Voice available (Dev Client / Ejected) ───────────────────────────
    if (Voice && Platform.OS !== 'web' && isVoiceAvailable.current) {
      setTranscript('');
      setLineItems([]);
      setRecording(true);
      try {
        await Voice.start(getLocale());
      } catch (err: any) {
        setRecording(false);
        setError(
          language === 'ta'       ? 'மைக் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' :
          language === 'tanglish' ? 'Mic start aagavillai. Marubadiyum try pannavum.' :
          'Could not start microphone. Please try again.'
        );
      }
      return;
    }

    // ── Expo Go / Web: Seamless Keyboard Dictation Mode ────────────────────────
    // Focus the input so the user can tap the phone's native keyboard mic button (🎙️)
    // to dictate naturally in Tamil, Tanglish, or English.
    setInputMode('voice');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [recording, language, getLocale]);

  const handleProceed = () => {
    if (lineItems.length === 0) {
      Alert.alert('கவனம்', 'குறைந்தபட்சம் 1 பொருள் பில்லில் இருக்க வேண்டும்.');
      return;
    }
    setDraft(lineItems);
    router.push('/invoice-create');
  };

  const totalAmt = lineItems.reduce((s, l) => s + l.total, 0);
  const totalTax = lineItems.reduce((s, l) => s + l.cgst + l.sgst + l.igst, 0);

  // Dynamic titles
  const screenTitle = language === 'ta' ? 'குரல் மூலம் பில்லுங்கள்' : (language === 'tanglish' ? 'Voice Moolam Bill Podavum' : 'Voice Billing');
  const screenSub   = language === 'ta' ? 'Tamil Voice Billing' : (language === 'tanglish' ? 'Tanglish & Tamil Supported' : 'Speech to GST Invoice');

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>{screenTitle}</Text>
          <Text style={styles.topSub}>{screenSub}</Text>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => { setTranscript(''); setLineItems([]); setError(null); }}
        >
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Waveform card */}
        <View style={styles.waveCard}>
          <View style={styles.waveRow}>
            {Array.from({ length: 40 }).map((_, i) => (
              <WaveBar key={i} active={recording} delay={i * 10 % 200} />
            ))}
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusBox}>
          {recording ? (
            <>
              <Text style={styles.statusMain}>
                {language === 'ta' ? 'பேசுங்கள்...' : (language === 'tanglish' ? 'Pesunggal...' : 'Listening...')}
              </Text>
              <Text style={styles.statusSub}>
                {language === 'ta' ? '(தமிழில் கேட்கிறது...)' : (language === 'tanglish' ? '(Tanglish / Tamil listening...)' : '(Speak items & prices...)')}
              </Text>
            </>
          ) : transcript ? (
            <>
              <Text style={styles.transcriptLabel}>
                {language === 'ta' ? '🗣️ கேட்ட வாக்கியம்:' : (language === 'tanglish' ? '🗣️ Ketta Vaakkiyam:' : '🗣️ Transcript:')}
              </Text>
              <View style={styles.transcriptBubble}>
                <Text style={styles.transcriptText}>"{transcript}"</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.statusMain}>
                {language === 'ta' ? 'மைக் அழுத்தி பேசவும்' : (language === 'tanglish' ? 'Mic thatti pesavum' : 'Tap mic to speak')}
              </Text>
              <Text style={styles.statusSub}>
                {language === 'ta' ? 'அல்லது கீழே உள்ள உதாரணத்தை தட்டவும்' : (language === 'tanglish' ? 'Alladhu keezhe ulla chips thattavum' : 'Or tap a quick chip below')}
              </Text>
            </>
          )}
          {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
        </View>

        {/* Mic button */}
        <View style={styles.micArea}>
          <MicButton recording={recording} onPress={handleRecord} />
          <Text style={styles.micHint}>
            {recording
              ? (language === 'ta' ? 'கேட்கிறது...' : (language === 'tanglish' ? 'Ketkudhu...' : 'Listening...'))
              : (language === 'ta' ? 'மைக் தட்டவும்' : (language === 'tanglish' ? 'Mic thattavum' : 'Tap to speak'))}
          </Text>
        </View>

        {/* 1-Tap Quick Sample Chips (Tamil & Tanglish) */}
        <View style={styles.chipsSection}>
          <Text style={styles.chipsTitle}>
            {language === 'ta' ? '⚡ விரைவு உதாரணங்கள் (Tap to test):' : (language === 'tanglish' ? '⚡ Viraivu Examples (Tap to test):' : '⚡ Quick Test Chips:')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {language === 'tanglish' ? (
              <>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('2 arisi 120 roobai')}>
                  <Text style={styles.chipText}>🌾 2 arisi 120</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('5 ennai 140 roobai')}>
                  <Text style={styles.chipText}>🫗 5 ennai 140</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('10 sakkarai 45')}>
                  <Text style={styles.chipText}>🍬 10 sakkarai 45</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('4 paal 25')}>
                  <Text style={styles.chipText}>🥛 4 paal 25</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('2 arisi 120, 3 sakkarai 45, 1 ennai 140')}>
                  <Text style={styles.chipText}>📦 Multi items</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('2 அரிசி 120 ரூபாய்')}>
                  <Text style={styles.chipText}>🌾 2 அரிசி</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('5 எண்ணெய் 140 ரூபாய்')}>
                  <Text style={styles.chipText}>🫗 5 எண்ணெய்</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('10 சர்க்கரை 45 ரூபாய்')}>
                  <Text style={styles.chipText}>🍬 10 சர்க்கரை</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('4 பால் 25 ரூபாய்')}>
                  <Text style={styles.chipText}>🥛 4 பால்</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => parseUtterance('2 அரிசி 120, 3 சர்க்கரை 45, 1 எண்ணெய் 140')}>
                  <Text style={styles.chipText}>📦 பல பொருட்கள்</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, inputMode === 'voice' && styles.modeBtnOn]}
            onPress={() => setInputMode('voice')}
          >
            <Text style={[styles.modeBtnText, inputMode === 'voice' && styles.modeBtnTextOn]}>
              {language === 'tanglish' ? '🎙️ Voice (Tanglish)' : '🎙️ Voice Mode'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, inputMode === 'keyboard' && styles.modeBtnOn]}
            onPress={() => setInputMode('keyboard')}
          >
            <Text style={[styles.modeBtnText, inputMode === 'keyboard' && styles.modeBtnTextOn]}>
              {language === 'tanglish' ? '⌨️ Type Tanglish' : '⌨️ Type Text'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Voice Dictation / Text Input Box */}
        <View style={styles.keyArea}>
          <View style={styles.dictationHead}>
            <Text style={styles.dictationTitle}>
              {language === 'ta'
                ? '🎙️ நேரலை குரல் பதிவு / டிக்டேஷன்'
                : language === 'tanglish'
                ? '🎙️ Live Voice Dictation / Input'
                : '🎙️ Live Voice Dictation / Input'}
            </Text>
            <Text style={styles.dictationBadge}>
              {inputMode === 'voice' ? '🎙️ Mic Ready' : '⌨️ Text Ready'}
            </Text>
          </View>
          <Text style={styles.dictationHint}>
            {language === 'ta'
              ? 'விசைப்பலகையில் உள்ள மைக் 🎙️ ஐ அழுத்தி நேரடியாக தமிழில் பேசலாம் அல்லது தட்டச்சு செய்யலாம்:'
              : language === 'tanglish'
              ? 'Keyboard-la ulla mic 🎙️ thatti Tanglish/Tamil-la pesalaam or type pannalaam:'
              : 'Tap the mic 🎙️ on your mobile keyboard to dictate, or type items:'}
          </Text>
          <TextInput
            ref={inputRef}
            style={styles.keyInput}
            value={textInput}
            onChangeText={(text) => {
              setTextInput(text);
              if (text.trim().length > 3) {
                parseUtterance(text);
              }
            }}
            placeholder={
              language === 'ta'
                ? 'எ.கா: 2 அரிசி 120, 5 எண்ணெய் 140 ரூபாய்'
                : language === 'tanglish'
                ? 'e.g.: 2 arisi 120, 5 ennai 140 roobai'
                : 'e.g.: 2 rice 120, 5 oil 140'
            }
            placeholderTextColor="#9E9E9E"
            multiline
            numberOfLines={2}
          />
          <View style={styles.inputActionRow}>
            {textInput.length > 0 && (
              <TouchableOpacity
                style={styles.inputClearBtn}
                onPress={() => {
                  setTextInput('');
                  setTranscript('');
                }}
              >
                <Text style={styles.inputClearText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.parseBtn}
              onPress={() => {
                if (textInput.trim()) {
                  parseUtterance(textInput);
                }
              }}
            >
              <Text style={styles.parseBtnText}>
                {language === 'ta'
                  ? 'பில் உருவாக்கு (Parse Bill) ›'
                  : language === 'tanglish'
                  ? 'Bill Uruvaakku (Parse Bill) ›'
                  : 'Parse Bill ›'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Parsed items */}
        {lineItems.length > 0 && (
          <View style={styles.itemsCard}>
            <View style={styles.itemsCardHead}>
              <Text style={styles.itemsHeader}>
                {language === 'ta' ? `🛒 பிரிக்கப்பட்ட பொருட்கள் (${lineItems.length})` : (language === 'tanglish' ? `🛒 Parsed Porutkal (${lineItems.length})` : `🛒 Parsed Items (${lineItems.length})`)}
              </Text>
              <Text style={styles.itemsCount}>GST Ready</Text>
            </View>

            {lineItems.map((item, idx) => (
              <View key={`${item.productId}-${idx}`} style={styles.itemRow}>
                <View style={styles.itemIconWrap}>
                  <Text style={styles.itemIcon}>📦</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemSub}>
                    {item.quantity} {item.unit} × ₹{item.rate} • GST {item.gstRate}%
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemTotal}>₹{item.total.toFixed(2)}</Text>
                  <Text style={styles.itemTax}>(வரி: ₹{(item.cgst + item.sgst).toFixed(2)})</Text>
                </View>
              </View>
            ))}

            <View style={styles.itemsDivider} />
            <View style={styles.itemsSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {language === 'ta' ? 'வரிக்கு முந்தைய தொகை' : (language === 'tanglish' ? 'Taxable Amount' : 'Taxable Subtotal')}
                </Text>
                <Text style={styles.summaryVal}>₹{(totalAmt - totalTax).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {language === 'ta' ? 'மொத்த வரி (CGST + SGST)' : (language === 'tanglish' ? 'Moththa GST (CGST+SGST)' : 'Total Tax (GST)')}
                </Text>
                <Text style={styles.summaryVal}>₹{totalTax.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>
                  {language === 'ta' ? 'மொத்த தொகை (Grand Total)' : (language === 'tanglish' ? 'Moththam (Grand Total)' : 'Grand Total')}
                </Text>
                <Text style={styles.totalVal}>₹{totalAmt.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed}>
              <Text style={styles.proceedText}>
                {language === 'ta'
                  ? 'Invoice உருவாக்கு (Proceed) ›'
                  : (language === 'tanglish'
                    ? 'Invoice Uruvaakku (Proceed) ›'
                    : 'Proceed to Invoice ›')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const waveStyles = StyleSheet.create({
  bar: { width: 3, backgroundColor: '#43A047', borderRadius: 2, marginHorizontal: 1.5, alignSelf: 'center' },
});

const micStyles = StyleSheet.create({
  wrap:       { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  ring1:      { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: G_DARK },
  ring2:      { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: G_MED },
  btn:        { width: 70, height: 70, borderRadius: 35, backgroundColor: G_DARK, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  btnActive:  { backgroundColor: '#C62828' },
  icon:       { fontSize: 32 },
  stopSquare: { width: 22, height: 22, backgroundColor: '#fff', borderRadius: 4 },
});

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#F4F7F4' },
  topBar:           { backgroundColor: G_DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backArrow:        { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '700' },
  topTitle:         { color: '#fff', fontSize: 18, fontWeight: '800' },
  topSub:           { color: '#A5D6A7', fontSize: 11, fontWeight: '600' },
  clearBtn:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  clearText:        { color: '#fff', fontSize: 11, fontWeight: '700' },
  scroll:           { flex: 1 },
  content:          { padding: 16, paddingBottom: 60 },
  waveCard:         { backgroundColor: '#E8F5E9', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12, marginBottom: 12, alignItems: 'center' },
  waveRow:          { flexDirection: 'row', height: 44, alignItems: 'center' },
  statusBox:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 },
  statusMain:       { fontSize: 16, fontWeight: '800', color: '#212121' },
  statusSub:        { fontSize: 12, color: '#757575', marginTop: 2 },
  transcriptLabel:  { fontSize: 11, fontWeight: '700', color: G_DARK, marginBottom: 4 },
  transcriptBubble: { backgroundColor: '#F0F7F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  transcriptText:   { fontSize: 13, color: '#1B5E20', fontWeight: '700', textAlign: 'center' },
  errorText:        { color: '#D32F2F', fontSize: 12, marginTop: 6, fontWeight: '600', textAlign: 'center' },
  micArea:          { alignItems: 'center', marginVertical: 12 },
  micHint:          { fontSize: 12, color: '#757575', marginTop: 8, fontWeight: '600' },
  chipsSection:     { marginBottom: 14 },
  chipsTitle:       { fontSize: 11, fontWeight: '800', color: '#616161', marginBottom: 8 },
  chipsRow:         { flexDirection: 'row' },
  chip:             { backgroundColor: '#fff', borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipText:         { fontSize: 12, fontWeight: '700', color: G_DARK },
  modeRow:          { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modeBtn:          { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  modeBtnOn:        { backgroundColor: G_DARK, borderColor: G_DARK },
  modeBtnText:      { fontSize: 12, fontWeight: '700', color: '#757575' },
  modeBtnTextOn:    { color: '#fff' },
  keyArea:          { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#C8E6C9' },
  dictationHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dictationTitle:   { fontSize: 13, fontWeight: '800', color: G_DARK },
  dictationBadge:   { fontSize: 10, fontWeight: '700', color: G_DARK, backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dictationHint:    { fontSize: 11, color: '#616161', marginBottom: 10, lineHeight: 16 },
  keyInput:         { backgroundColor: '#F9FBE7', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 64, textAlignVertical: 'top', borderWidth: 1, borderColor: '#DCEDC8', color: '#1B5E20', fontWeight: '600' },
  inputActionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 10 },
  inputClearBtn:    { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F5F5F5' },
  inputClearText:   { color: '#757575', fontSize: 12, fontWeight: '700' },
  parseBtn:         { backgroundColor: G_DARK, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center' },
  parseBtnText:     { color: '#fff', fontSize: 13, fontWeight: '800' },
  itemsCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  itemsCardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemsHeader:      { fontSize: 15, fontWeight: '800', color: '#212121' },
  itemsCount:       { fontSize: 11, fontWeight: '700', color: '#43A047', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  itemRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  itemIconWrap:     { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  itemIcon:         { fontSize: 18 },
  itemInfo:         { flex: 1 },
  itemName:         { fontSize: 14, fontWeight: '700', color: '#212121' },
  itemSub:          { fontSize: 11, color: '#757575', marginTop: 2 },
  itemTotal:        { fontSize: 14, fontWeight: '800', color: G_DARK },
  itemTax:          { fontSize: 10, color: '#757575' },
  itemsDivider:     { height: 1, backgroundColor: '#E0E0E0', marginVertical: 12 },
  itemsSummary:     { gap: 6, marginBottom: 16 },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel:     { fontSize: 12, color: '#616161' },
  summaryVal:       { fontSize: 12, fontWeight: '600', color: '#212121' },
  totalRow:         { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  totalLabel:       { fontSize: 14, fontWeight: '800', color: G_DARK },
  totalVal:         { fontSize: 16, fontWeight: '900', color: G_DARK },
  proceedBtn:       { backgroundColor: G_DARK, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  proceedText:      { color: '#fff', fontSize: 14, fontWeight: '800' },
});

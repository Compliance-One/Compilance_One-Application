/**
 * Dashboard — Premium Redesign
 * - Time-based greeting for Morning, Afternoon, Evening, Night
 * - Full Tamil, Tanglish, and English language switching support
 * - Dark green header with 3-way instant language toggle chip
 * - Live stats, colorful tiles, animated voice CTA, recent invoices
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/client';
import { invoices } from '../../db/schema';
import { sum, count, desc } from 'drizzle-orm';

const { width: SW } = Dimensions.get('window');
const G_DARK  = '#1B5E20';
const G_MED   = '#2E7D32';
const G_LIGHT = '#43A047';

export type AppLang = 'ta' | 'en' | 'tanglish';

// ─── Time-based Greeting Helper ──────────────────────────────────────────────
export function getGreetingTime(lang: AppLang = 'ta') {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) {
    // 5:00 AM – 11:59 AM: Morning
    if (lang === 'ta') return 'காலை வணக்கம்! 🌅';
    if (lang === 'tanglish') return 'Kaalai Vanakkam! 🌅';
    return 'Good Morning! 🌅';
  } else if (h >= 12 && h < 17) {
    // 12:00 PM – 4:59 PM: Afternoon
    if (lang === 'ta') return 'மதிய வணக்கம்! ☀️';
    if (lang === 'tanglish') return 'Madhiya Vanakkam! ☀️';
    return 'Good Afternoon! ☀️';
  } else if (h >= 17 && h < 21) {
    // 5:00 PM – 8:59 PM: Evening
    if (lang === 'ta') return 'மாலை வணக்கம்! 🌆';
    if (lang === 'tanglish') return 'Maalai Vanakkam! 🌆';
    return 'Good Evening! 🌆';
  } else {
    // 9:00 PM – 4:59 AM: Night
    if (lang === 'ta') return 'இரவு வணக்கம்! 🌙';
    if (lang === 'tanglish') return 'Iravu Vanakkam! 🌙';
    return 'Good Night! 🌙';
  }
}

// ─── Date Formatter in Tamil, Tanglish & English ──────────────────────────────
const DAYS_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const MONTHS_TA = [
  'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
  'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
];

const DAYS_TANGLSIH = ['Gnaayiru', 'Thingal', 'Sevvai', 'Budhan', 'Viyaazhan', 'Velli', 'Sani'];

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDateString(lang: AppLang = 'ta') {
  const now = new Date();
  if (lang === 'ta') {
    return `${DAYS_TA[now.getDay()]}, ${now.getDate()} ${MONTHS_TA[now.getMonth()]} ${now.getFullYear()}`;
  }
  if (lang === 'tanglish') {
    return `${DAYS_TANGLSIH[now.getDay()]}, ${now.getDate()} ${MONTHS_EN[now.getMonth()]} ${now.getFullYear()}`;
  }
  return `${DAYS_EN[now.getDay()]}, ${now.getDate()} ${MONTHS_EN[now.getMonth()]} ${now.getFullYear()}`;
}

// ─── Feature Tiles with Tanglish Support ─────────────────────────────────────
const TILES = [
  {
    id: 'invoice',
    emoji: '📄',
    labelTa: 'புதிய பில்',
    labelTanglish: 'Pudhiya Bill',
    labelEn: 'New Invoice',
    subTa: 'பில் போடு',
    subTanglish: 'Bill Podu',
    subEn: 'Create Bill',
    route: '/invoice-create',
    iconBg: '#FDE8E8',
    iconBorder: '#F44336',
  },
  {
    id: 'products',
    emoji: '📦',
    labelTa: 'பொருட்கள்',
    labelTanglish: 'Porutkal',
    labelEn: 'Products',
    subTa: 'பொருட்கள் பட்டியல்',
    subTanglish: 'Catalog & HSN',
    subEn: 'Catalog & HSN',
    route: '/products',
    iconBg: '#E3F2FD',
    iconBorder: '#1E88E5',
  },
  {
    id: 'customers',
    emoji: '👥',
    labelTa: 'வாடிக்கையாளர்',
    labelTanglish: 'Vaadikkaiyaalar',
    labelEn: 'Customers',
    subTa: 'கடன் & நிலுவை',
    subTanglish: 'Kadan & Dues',
    subEn: 'Ledger & Dues',
    route: '/customers',
    iconBg: '#F3E5F5',
    iconBorder: '#8E24AA',
  },
  {
    id: 'reports',
    emoji: '📊',
    labelTa: 'அறிக்கைகள்',
    labelTanglish: 'Arikkaigal',
    labelEn: 'Reports',
    subTa: 'விற்பனை விவரம்',
    subTanglish: 'GST Summary',
    subEn: 'GST Summary',
    route: '/reports',
    iconBg: '#FFF3E0',
    iconBorder: '#FB8C00',
  },
  {
    id: 'inventory',
    emoji: '🏪',
    labelTa: 'சரக்கு இருப்பு',
    labelTanglish: 'Sarakku Iruppu',
    labelEn: 'Inventory',
    subTa: 'கையிருப்பு',
    subTanglish: 'Stock Levels',
    subEn: 'Stock Levels',
    route: '/inventory',
    iconBg: '#E0F2F1',
    iconBorder: '#00897B',
  },
  {
    id: 'gstr1',
    emoji: '🏛️',
    labelTa: 'GSTR-1 அறிக்கை',
    labelTanglish: 'GSTR-1 Arikkai',
    labelEn: 'GSTR-1 Export',
    subTa: 'ஜிஎஸ்டி தாக்கல்',
    subTanglish: 'GST Filing',
    subEn: 'Filing Payload',
    route: '/gstr1-export',
    iconBg: '#E8F5E9',
    iconBorder: '#43A047',
  },
];

function PulsingMic() {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse1, { toValue: 1.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse1, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={ctaStyles.micWrap}>
      <Animated.View style={[ctaStyles.pulse2, { transform: [{ scale: pulse2 }] }]} />
      <Animated.View style={[ctaStyles.pulse1, { transform: [{ scale: pulse1 }] }]} />
      <View style={ctaStyles.micCircle}>
        <Text style={ctaStyles.micEmoji}>🎙️</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router      = useRouter();
  const business    = useAppStore((s) => s.business);
  const isOffline   = useAppStore((s) => s.isOffline);
  const language    = (useAppStore((s) => s.language) || 'ta') as AppLang;
  const setLanguage = useAppStore((s) => s.setLanguage);

  const [todaySales,     setTodaySales]     = useState(2145);
  const [todayCount,     setTodayCount]     = useState(3);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([
    { no: 'INV-0001', name: 'Senthil Kumar (செந்தில்)', amt: '₹319.50', status: 'paid' },
    { no: 'INV-0002', name: 'Murugan Traders', amt: '₹1,260.00', status: 'unpaid' },
    { no: 'INV-0003', name: 'Cash Counter (ரொக்கம்)', amt: '₹609.00', status: 'paid' },
  ]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Load actual sales stats and invoices from SQLite
    db.select({ total: sum(invoices.grandTotal), cnt: count(invoices.id) })
      .from(invoices)
      .then((rows: any[]) => {
        const r = rows[0] as any;
        const t = Number(r?.total ?? 0);
        const c = Number(r?.cnt ?? 0);
        if (t > 0) setTodaySales(t);
        if (c > 0) setTodayCount(c);
      })
      .catch(() => {});

    // Safely query recent invoices
    const fetchRecentInvoices = async () => {
      try {
        let q: any = db.select().from(invoices);
        if (typeof q.orderBy === 'function') q = q.orderBy(desc(invoices.createdAt));
        if (typeof q.limit === 'function') q = q.limit(4);
        const invList = await q;
        if (invList && invList.length > 0) {
          setRecentInvoices(invList.slice(0, 4).map((i: any) => ({
            no: i.invoiceNumber,
            name: i.notes || (i.invoiceType === 'B2B' ? 'B2B Trade' : 'Walk-In Customer'),
            amt: `₹${Number(i.grandTotal).toFixed(2)}`,
            status: i.paymentStatus,
          })));
        }
      } catch (_e) {}
    };
    fetchRecentInvoices();
  }, []);

  const greeting = getGreetingTime(language);
  const dateText = getDateString(language);

  // Cycle languages: ta -> tanglish -> en -> ta
  const handleCycleLang = () => {
    if (language === 'ta') setLanguage('tanglish');
    else if (language === 'tanglish') setLanguage('en');
    else setLanguage('ta');
  };

  const getLangBadge = () => {
    if (language === 'ta') return '🇮🇳 தமிழ்';
    if (language === 'tanglish') return '🔤 Tanglish';
    return '🇬🇧 English';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* ── Sticky Header ───────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Compliance One</Text>
          <Text style={styles.headerSub}>{business?.businessName ?? 'Compliance Store'}</Text>
        </View>

        <View style={styles.headerRight}>
          {/* 3-Way Quick Language Toggle */}
          <TouchableOpacity
            style={styles.langToggle}
            onPress={handleCycleLang}
            activeOpacity={0.75}
          >
            <Text style={styles.langToggleText}>{getLangBadge()}</Text>
          </TouchableOpacity>

          <View style={[styles.onlinePill, isOffline && styles.offlinePill]}>
            <View style={[styles.onlineDot, isOffline && styles.offlineDot]} />
            <Text style={styles.onlineText}>{isOffline ? 'Off' : 'On'}</Text>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── Greeting Card ──────────────────────────────── */}
        <View style={styles.greetCard}>
          <View style={styles.greetCircle1} />
          <View style={styles.greetCircle2} />

          <View style={styles.greetBody}>
            <View style={{ flex: 1 }}>
              {/* Dynamic Time & Language/Tanglish Greeting */}
              <Text style={styles.greetTime}>{greeting}</Text>
              <Text style={styles.greetDate}>📅 {dateText}</Text>
              <View style={styles.greetGstinRow}>
                <Text style={styles.greetGstin}>
                  {business?.gstin ? `GSTIN: ${business.gstin}` : 'GSTIN: 33ABCDE1234F1Z5'}
                </Text>
              </View>
            </View>
            <Text style={styles.greetShop}>🏪</Text>
          </View>
        </View>

        {/* ── Stat Cards ─────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardGreen]}>
            <View style={styles.statTop}>
              <Text style={styles.statLabel}>
                {language === 'ta' ? 'இன்றைய விற்பனை' : (language === 'tanglish' ? 'Inraiya Virpanai' : "Today's Sales")}
              </Text>
              <Text style={styles.statTrend}>📈</Text>
            </View>
            <Text style={styles.statValue}>₹{todaySales.toLocaleString('en-IN')}</Text>
            <Text style={styles.statSub}>
              {language === 'ta' ? 'ஜிஎஸ்டி விற்பனை' : (language === 'tanglish' ? 'GST Virpanai' : 'GST Total')}
            </Text>
          </View>

          <View style={[styles.statCard, styles.statCardWhite]}>
            <View style={styles.statTop}>
              <Text style={[styles.statLabel, { color: '#424242' }]}>
                {language === 'ta' ? 'இன்றைய பில்கள்' : (language === 'tanglish' ? 'Inraiya Bills' : 'Invoices')}
              </Text>
              <View style={styles.statIconCircle}>
                <Text style={{ fontSize: 16 }}>📄</Text>
              </View>
            </View>
            <Text style={[styles.statValue, { color: G_DARK }]}>{todayCount}</Text>
            <Text style={[styles.statSub, { color: '#9E9E9E' }]}>
              {language === 'ta' ? 'பில்கள் பதிவு' : (language === 'tanglish' ? 'Bills Pathivu' : 'Bills Generated')}
            </Text>
          </View>
        </View>

        {/* ── Voice Billing CTA ──────────────────────────── */}
        <Text style={styles.sectionTitle}>
          {language === 'ta' ? 'குரல் பில்லிங் (VOICE BILLING)' : (language === 'tanglish' ? 'VOICE BILLING (KURAL)' : 'VOICE BILLING')}
        </Text>
        <TouchableOpacity
          style={styles.voiceCta}
          onPress={() => router.push('/voice-billing' as any)}
          activeOpacity={0.88}
        >
          <View style={styles.greetCircle1x} />
          <PulsingMic />
          <View style={styles.voiceCtaText}>
            <Text style={styles.voiceCtaTitle}>
              {language === 'ta'
                ? 'குரல் மூலம் பில் போடுங்கள்'
                : (language === 'tanglish'
                  ? 'Voice Moolam Bill Podavum'
                  : 'Create Voice Bill in Tamil')}
            </Text>
            <Text style={styles.voiceCtaSub}>
              {language === 'ta'
                ? 'மைக் தட்டி பேசவும் ›'
                : (language === 'tanglish'
                  ? 'Mic thatti pesa aarambikkavum ›'
                  : 'Tap mic and speak items & prices ›')}
            </Text>
          </View>
          <Text style={styles.voiceCtaArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Quick Access Tiles ─────────────────────────── */}
        <Text style={styles.sectionTitle}>
          {language === 'ta'
            ? 'விரைவு சேவைகள் (QUICK ACCESS)'
            : (language === 'tanglish'
              ? 'VIRAIVU SEVAIGAL (QUICK ACCESS)'
              : 'QUICK ACCESS')}
        </Text>
        <View style={styles.tilesGrid}>
          {TILES.map((t) => {
            const label = language === 'ta' ? t.labelTa : (language === 'tanglish' ? t.labelTanglish : t.labelEn);
            const sub = language === 'ta' ? t.subTa : (language === 'tanglish' ? t.subTanglish : t.subEn);
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.tile}
                onPress={() => router.push(t.route as any)}
                activeOpacity={0.80}
              >
                <View style={[styles.tileIconCircle, { backgroundColor: t.iconBg, borderColor: t.iconBorder }]}>
                  <Text style={styles.tileEmoji}>{t.emoji}</Text>
                </View>
                <Text style={styles.tileLabelTa}>{label}</Text>
                <Text style={styles.tileSub}>{sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Recent Invoices Section ────────────────────── */}
        <View style={styles.recentSectionHeader}>
          <Text style={styles.sectionTitleRaw}>
            {language === 'ta'
              ? 'சமீபத்திய பில்கள் (RECENT INVOICES)'
              : (language === 'tanglish'
                ? 'SAMEEBATHIYA BILLS (RECENT)'
                : 'RECENT INVOICES')}
          </Text>
          <TouchableOpacity onPress={() => router.push('/invoices' as any)}>
            <Text style={styles.seeAllLink}>
              {language === 'ta' ? 'அனைத்தும் ›' : (language === 'tanglish' ? 'Anaithum ›' : 'View All ›')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentCard}>
          {recentInvoices.map((inv, idx) => {
            const isPaid = inv.status === 'paid';
            let statusLabel = 'Paid';
            if (language === 'ta') statusLabel = isPaid ? 'முடிந்தது' : 'நிலுவை';
            else if (language === 'tanglish') statusLabel = isPaid ? 'Paid (Mudinthathu)' : 'Niluvai (Due)';
            else statusLabel = isPaid ? 'Paid' : 'Unpaid';

            return (
              <TouchableOpacity
                key={`${inv.no}-${idx}`}
                style={[styles.recentRow, idx === recentInvoices.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => router.push('/invoices' as any)}
              >
                <View style={[styles.recentDot, isPaid ? styles.recentDotPaid : styles.recentDotUnpaid]} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentNo}>{inv.no}</Text>
                  <Text style={styles.recentName}>{inv.name}</Text>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentAmt}>{inv.amt}</Text>
                  <View style={[styles.recentBadge, isPaid ? styles.badgePaid : styles.badgeUnpaid]}>
                    <Text style={[styles.recentBadgeText, isPaid ? styles.textPaid : styles.textUnpaid]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const ctaStyles = StyleSheet.create({
  micWrap:    { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  pulse2:     { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  pulse1:     { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
  micCircle:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  micEmoji:   { fontSize: 22 },
});

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F4F7F4' },
  header:       { backgroundColor: G_DARK, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle:  { fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  headerSub:    { fontSize: 12, color: '#A5D6A7', marginTop: 1, fontWeight: '600' },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langToggle:   { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  langToggleText:{ color: '#fff', fontSize: 11, fontWeight: '800' },
  onlinePill:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, gap: 5 },
  offlinePill:  { backgroundColor: 'rgba(229,57,53,0.25)' },
  onlineDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#69F0AE' },
  offlineDot:   { backgroundColor: '#FF5252' },
  onlineText:   { fontSize: 11, color: '#fff', fontWeight: '700' },
  scroll:       { flex: 1 },
  content:      { paddingBottom: 16 },

  // Greeting Card
  greetCard:    { margin: 16, marginBottom: 12, backgroundColor: G_MED, borderRadius: 20, padding: 20, overflow: 'hidden', elevation: 4, shadowColor: G_DARK, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  greetCircle1: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -30 },
  greetCircle1x:{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', top: -30, right: -20 },
  greetCircle2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: 60 },
  greetBody:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetTime:    { fontSize: 21, fontWeight: '900', color: '#fff' },
  greetDate:    { fontSize: 12, color: '#C8E6C9', marginTop: 5, fontWeight: '600' },
  greetGstinRow:{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  greetGstin:   { fontSize: 11, color: '#E8F5E9', fontWeight: '700', letterSpacing: 0.5 },
  greetShop:    { fontSize: 54 },

  // Stats
  statsRow:     { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 14 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  statCardGreen:{ backgroundColor: G_DARK },
  statCardWhite:{ backgroundColor: '#fff' },
  statTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statLabel:    { fontSize: 11, color: '#A5D6A7', fontWeight: '700' },
  statTrend:    { fontSize: 16 },
  statIconCircle:{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  statValue:    { fontSize: 22, fontWeight: '900', color: '#fff' },
  statSub:      { fontSize: 11, color: '#81C784', marginTop: 3 },

  // Section title
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#616161', marginHorizontal: 16, marginBottom: 8, marginTop: 4, letterSpacing: 0.5 },
  recentSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  sectionTitleRaw: { fontSize: 12, fontWeight: '800', color: '#616161', letterSpacing: 0.5 },
  seeAllLink:   { fontSize: 12, fontWeight: '800', color: G_DARK },

  // Tiles
  tilesGrid:    { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 8, marginBottom: 16 },
  tile:         { width: (SW - 52) / 3, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  tileIconCircle:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1.5 },
  tileEmoji:    { fontSize: 22 },
  tileLabelTa:  { fontSize: 11, fontWeight: '800', color: '#212121', textAlign: 'center' },
  tileSub:      { fontSize: 10, color: '#757575', textAlign: 'center', marginTop: 2 },

  // Voice CTA
  voiceCta:     { marginHorizontal: 16, backgroundColor: G_DARK, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, elevation: 3, shadowColor: G_DARK, shadowOpacity: 0.3, shadowRadius: 8, overflow: 'hidden' },
  voiceCtaText: { flex: 1 },
  voiceCtaTitle:{ fontSize: 15, fontWeight: '900', color: '#fff' },
  voiceCtaSub:  { fontSize: 11, color: '#A5D6A7', marginTop: 3, fontWeight: '600' },
  voiceCtaArrow:{ fontSize: 24, color: '#A5D6A7', fontWeight: '700' },

  // Recent
  recentCard:   { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, marginBottom: 16 },
  recentRow:    { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 10 },
  recentDot:    { width: 8, height: 8, borderRadius: 4 },
  recentDotPaid:{ backgroundColor: G_LIGHT },
  recentDotUnpaid:{ backgroundColor: '#FB8C00' },
  recentInfo:   { flex: 1 },
  recentNo:     { fontSize: 13, fontWeight: '700', color: G_DARK },
  recentName:   { fontSize: 11, color: '#757575', marginTop: 2 },
  recentRight:  { alignItems: 'flex-end', gap: 3 },
  recentAmt:    { fontSize: 14, fontWeight: '900', color: '#212121' },
  recentBadge:  { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgePaid:    { backgroundColor: '#E8F5E9' },
  badgeUnpaid:  { backgroundColor: '#FFF3E0' },
  recentBadgeText:{ fontSize: 10, fontWeight: '700' },
  textPaid:     { color: G_MED },
  textUnpaid:   { color: '#E65100' },
});

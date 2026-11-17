/**
 * Simple Home: today's money at a glance and six big tiles.
 * Tamil-first labels with the other language underneath.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getDb } from '../../db/schema';
import { getDaySummary, type DaySummary } from '../../db/repositories';
import { formatINR } from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';
import { BigButton, font, rad, Screen, sp, Tile, ui, useBilingual } from '../../ui';

export default function HomeScreen() {
  const { t } = useTranslation();
  const bi = useBilingual();
  const navigation = useNavigation<any>();
  const business = useAppStore((s) => s.business);
  const [summary, setSummary] = useState<DaySummary | null>(null);

  // Refresh every time Home comes back into view (e.g. after a new bill).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!business?.id) return;
      void (async () => {
        try {
          const db = await getDb();
          const s = await getDaySummary(db, business.id);
          if (!cancelled) setSummary(s);
        } catch (e) {
          if (__DEV__) console.warn('[home] summary failed', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [business?.id])
  );

  const goTab = (screen: string) => navigation.navigate('MainTabs', { screen });
  const tiles: Array<{ key: string; icon: string; onPress: () => void; color: string; tint: string }> = [
    { key: 'home.newBill', icon: '🧾', onPress: () => goTab('Bill'), color: '#0E4D3A', tint: '#D7F0E3' },
    { key: 'home.moneyIn', icon: '💰', onPress: () => navigation.navigate('Ledger'), color: '#1B6E3A', tint: '#DDF5D9' },
    { key: 'home.today', icon: '📅', onPress: () => navigation.navigate('Invoices'), color: '#1D4F91', tint: '#DCE9FB' },
    { key: 'home.credit', icon: '📒', onPress: () => goTab('Credit'), color: '#8A5A00', tint: '#FBEFCF' },
    { key: 'home.items', icon: '📦', onPress: () => goTab('Items'), color: '#7A3E9D', tint: '#EFE2F8' },
    { key: 'home.more', icon: '✨', onPress: () => goTab('More'), color: '#A9402C', tint: '#FBE3DC' },
  ];

  const cash = summary ? summary.cashReceived + summary.upiReceived : 0;

  return (
    <Screen edges={['top']}>
      <View style={{ gap: 2 }}>
        <Text style={[font.body, { color: ui.textSoft }]}>{t('home.greeting')}</Text>
        <Text style={[font.title, { color: ui.text }]} numberOfLines={1}>
          {business?.name ?? ''}
        </Text>
      </View>

      <View style={s.strip}>
        <Stat label={bi('home.todaySales')} value={formatINR(summary?.salesTotal ?? 0, false)} />
        <View style={s.divider} />
        <Stat label={bi('home.cashToday')} value={formatINR(cash, false)} />
        <View style={s.divider} />
        <Stat label={bi('home.owed')} value={formatINR(summary?.owedToYou ?? 0, false)} warn={(summary?.owedToYou ?? 0) > 0} />
      </View>

      <View style={s.grid}>
        {tiles.map((tile) => {
          const [main, sub] = bi(tile.key);
          return <Tile key={tile.key} icon={tile.icon} label={main} sublabel={sub} onPress={tile.onPress} color={tile.color} tint={tile.tint} />;
        })}
      </View>

      <BigButton
        icon="🎤"
        label={bi('home.voiceBill')[0]}
        sublabel={bi('home.voiceBill')[1]}
        variant="secondary"
        onPress={() => goTab('Bill')}
      />
    </Screen>
  );
}

function Stat({ label, value, warn }: { label: [string, string]; value: string; warn?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={[font.money, { color: warn ? ui.turmeric : ui.onDark, fontSize: 20 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[font.small, { color: ui.onDark, textAlign: 'center' }]} numberOfLines={2}>
        {label[0]}
      </Text>
      <Text style={[font.small, { color: ui.onDarkSoft, fontSize: 11, lineHeight: 14 }]} numberOfLines={1}>
        {label[1]}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    backgroundColor: ui.primary,
    borderRadius: rad.hero,
    paddingVertical: sp.lg,
    paddingHorizontal: sp.sm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 2 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.md },
});

/**
 * Settings: language (persisted) and the business this device is showing.
 * Business profile fields can be edited and saved to SQLite.
 */
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, typo } from '../../theme';
import { useReport } from '../../hooks/useReport';
import { AmountRow, Card, PrimaryButton, ReportState, ScreenHeader, SecondaryButton, Segmented, SectionTitle } from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';
import { persistLanguage } from '../../i18n';
import { getDb } from '../../db/schema';
import { updateBusinessProfile } from '../../db/repositories';
import { logout } from '../../auth/session';
import { useAppStore } from '../../store/useAppStore';
import { INDIAN_STATES, isValidGstin, normalizeStateCode, stateNameFor } from '../../lib/gst';
import { CONFIG } from '../../config/env';
import PrinterPanel from './PrinterPanel';

type Lang = 'en' | 'ta';

export default function SettingsScreen(_props: ScreenProps) {
  const { t, i18n } = useTranslation();
  const store = useAppStore();
  const { state, reload } = useReport(async (_db, business) => business, []);
  const lang: Lang = i18n.language.startsWith('ta') ? 'ta' : 'en';

  const [name, setName] = useState(store.business?.name ?? '');
  const [gstin, setGstin] = useState(store.business?.gstin ?? '');
  const [stateCode, setStateCode] = useState(store.business?.stateCode ?? CONFIG.DEFAULT_STATE_CODE);
  const [openingCash, setOpeningCash] = useState(String(store.business?.openingCash ?? 0));
  const [openingBank, setOpeningBank] = useState(String(store.business?.openingBank ?? 0));

  useEffect(() => {
    if (store.business) {
      setName(store.business.name);
      setGstin(store.business.gstin ?? '');
      setStateCode(store.business.stateCode ?? CONFIG.DEFAULT_STATE_CODE);
      setOpeningCash(String(store.business.openingCash ?? 0));
      setOpeningBank(String(store.business.openingBank ?? 0));
    }
  }, [store.business?.id, store.business?.name, store.business?.gstin, store.business?.stateCode, store.business?.openingCash, store.business?.openingBank]);

  async function save() {
    if (!store.business) return;
    const clean = gstin.trim().toUpperCase();
    if (clean && !isValidGstin(clean)) {
      Alert.alert(t('settings.title'), t('settings.invalidGstin'));
      return;
    }
    const code = normalizeStateCode(stateCode) || CONFIG.DEFAULT_STATE_CODE;
    const db = await getDb();
    const cash = Number(openingCash) || 0;
    const bank = Number(openingBank) || 0;
    await updateBusinessProfile(db, store.business.id, {
      name: name.trim() || store.business.name,
      gstin: clean || null,
      stateCode: code,
      openingCash: cash,
      openingBank: bank,
    });
    store.updateBusiness({
      name: name.trim() || store.business.name,
      gstin: clean || undefined,
      stateCode: code,
      openingCash: cash,
      openingBank: bank,
    });
    Alert.alert(t('settings.saved'));
    reload();
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader title={t('settings.title')} />

      <View style={s.pad}>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Card style={{ gap: space.md }}>
          <Segmented<Lang>
            value={lang}
            onChange={(l) => {
              void persistLanguage(l);
            }}
            options={[
              { value: 'en', label: t('settings.english') },
              { value: 'ta', label: t('settings.tamil') },
            ]}
          />
          <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('settings.languageHint')}</Text>
        </Card>

        <ReportState state={state} onRetry={reload}>
          {() => (
            <>
              <SectionTitle>{t('settings.business')}</SectionTitle>
              <Card style={{ gap: space.sm }}>
                <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('settings.name')}</Text>
                <TextInput value={name} onChangeText={setName} style={s.input} />
                <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('settings.gstin')}</Text>
                <TextInput
                  value={gstin}
                  autoCapitalize="characters"
                  onChangeText={(v) => {
                    const clean = v.toUpperCase();
                    setGstin(clean);
                    if (clean.length >= 2) setStateCode(normalizeStateCode(clean.slice(0, 2)) || stateCode);
                  }}
                  style={s.input}
                />
                <AmountRow
                  label={t('settings.state')}
                  value={`${stateNameFor(stateCode)} (${normalizeStateCode(stateCode)})`}
                />
                <View style={s.states}>
                  {INDIAN_STATES.map((st) => (
                    <Text
                      key={st.code}
                      onPress={() => setStateCode(st.code)}
                      style={[s.stateChip, stateCode === st.code && s.stateChipOn]}
                    >
                      {st.code}
                    </Text>
                  ))}
                </View>
                <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('settings.openingCash')}</Text>
                <TextInput value={openingCash} onChangeText={setOpeningCash} keyboardType="numeric" style={s.input} />
                <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('settings.openingBank')}</Text>
                <TextInput value={openingBank} onChangeText={setOpeningBank} keyboardType="numeric" style={s.input} />
                <PrimaryButton label={t('settings.save')} onPress={() => void save()} />
              </Card>
            </>
          )}
        </ReportState>

        <PrinterPanel />

        <SectionTitle>{t('settings.account')}</SectionTitle>
        <Card style={{ gap: space.sm }}>
          <Text style={typo.bodyStrong}>{store.user?.name ?? ''}</Text>
          <Text style={[typo.caption, { color: colors.inkSoft }]}>{store.user?.phone || store.user?.email}</Text>
          <SecondaryButton label={t('auth.logout')} onPress={() => void logout()} />
        </Card>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: space.huge },
  pad: { paddingHorizontal: space.xl },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  states: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.paper,
    color: colors.inkSoft,
    overflow: 'hidden',
    fontSize: 12,
  },
  stateChipOn: { backgroundColor: colors.leafTint, color: colors.leaf, fontWeight: '700' },
});

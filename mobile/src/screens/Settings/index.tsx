/**
 * Settings: language and the business this device is showing.
 * Business profile, printer and backup belong to other modules and are not
 * stubbed here.
 *
 * TODO: the chosen language is not remembered between launches yet
 * (needs a storage package, e.g. @react-native-async-storage/async-storage).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, typo } from '../../theme';
import { useReport } from '../../hooks/useReport';
import { AmountRow, Card, ReportState, ScreenHeader, Segmented, SectionTitle } from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

type Lang = 'en' | 'ta';

export default function SettingsScreen(_props: ScreenProps) {
  const { t, i18n } = useTranslation();
  const { state, reload } = useReport(async (_db, business) => business, []);
  const lang: Lang = i18n.language === 'ta' ? 'ta' : 'en';

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader title={t('settings.title')} />

      <View style={s.pad}>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Card style={{ gap: space.md }}>
          <Segmented<Lang>
            value={lang}
            onChange={(l) => {
              i18n.changeLanguage(l);
            }}
            options={[
              { value: 'en', label: t('settings.english') },
              { value: 'ta', label: t('settings.tamil') },
            ]}
          />
          <Text style={[typo.caption, { color: colors.inkSoft }]}>{t('settings.languageHint')}</Text>
        </Card>

        <ReportState state={state} onRetry={reload}>
          {(business) => (
            <>
              <SectionTitle>{t('settings.business')}</SectionTitle>
              <Card>
                <AmountRow label={business.name} value="" />
                <AmountRow
                  label={t('settings.gstin')}
                  value={business.gstin ?? t('settings.gstinMissing')}
                  tone={business.gstin ? 'ink' : 'warn'}
                />
              </Card>
            </>
          )}
        </ReportState>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: space.huge },
  pad: { paddingHorizontal: space.xl },
});

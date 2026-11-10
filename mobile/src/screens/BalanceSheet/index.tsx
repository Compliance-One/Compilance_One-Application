/**
 * Balance Sheet: what you have, what you owe, and the net position.
 * Cash and bank are not tracked yet, so that row says so instead of showing
 * a misleading zero.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, typo } from '../../theme';
import { formatINR } from '../../lib/format';
import { useReport } from '../../hooks/useReport';
import { getBalanceSheet } from '../../db/views/balanceSheet';
import { AmountRow, Banner, Card, ReportState, ScreenHeader, SectionTitle } from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

export default function BalanceSheetScreen({ back, canGoBack }: ScreenProps) {
  const { t } = useTranslation();
  const { state, reload } = useReport((db, business) => getBalanceSheet(db, business.id), []);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader title={t('balanceSheet.title')} onBack={canGoBack ? back : undefined} />
      <ReportState state={state} onRetry={reload}>
        {(bs) => {
          const negative = bs.ownersCapital < 0;
          return (
            <View style={s.body}>
              <View style={[s.result, { backgroundColor: negative ? colors.brickTint : colors.leafTint }]}>
                <Text style={[typo.body, { color: negative ? colors.brick : colors.leaf }]}>
                  {t('balanceSheet.ownersCapital')}
                </Text>
                <Text
                  style={[typo.display, { color: negative ? colors.brick : colors.leaf }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatINR(bs.ownersCapital)}
                </Text>
              </View>

              <SectionTitle>{t('balanceSheet.assets')}</SectionTitle>
              <Card>
                <AmountRow label={t('balanceSheet.stockValue')} value={formatINR(bs.stockValue)} />
                <AmountRow label={t('balanceSheet.receivables')} value={formatINR(bs.receivables)} />
                <AmountRow label={t('balanceSheet.cashAndBank')} value={t('common.notTracked')} tone="faint" />
              </Card>

              <SectionTitle>{t('balanceSheet.liabilities')}</SectionTitle>
              <Card>
                <AmountRow label={t('balanceSheet.payables')} value={formatINR(bs.payables)} />
              </Card>

              <View style={{ marginTop: space.lg }}>
                <Banner tone="info" text={t('balanceSheet.note')} />
              </View>
            </View>
          );
        }}
      </ReportState>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: space.huge },
  body: { paddingHorizontal: space.xl },
  result: { borderRadius: radius.hero, padding: space.xl, gap: space.xs },
});

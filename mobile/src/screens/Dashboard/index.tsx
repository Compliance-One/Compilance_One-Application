/**
 * Home. The first thing an owner sees: how this month is going.
 * The profit figure sits on a ruled khata page; everything else stays quiet.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, typo } from '../../theme';
import { formatINR } from '../../lib/format';
import { monthRange, monthTitle, thisMonthRef } from '../../lib/periods';
import { useReport } from '../../hooks/useReport';
import { getDashboardSummary } from '../../db/views/dashboardSummary';
import { getProfitAndLoss } from '../../db/views/profitLoss';
import { getBalanceSheet } from '../../db/views/balanceSheet';
import { Card, LedgerHero, Meter, NavRow, ReportState, SectionTitle, StatTile } from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

export default function DashboardScreen({ navigate }: ScreenProps) {
  const { t } = useTranslation();
  const months = t('months', { returnObjects: true }) as unknown as string[];
  const ref = thisMonthRef();
  const range = monthRange(ref);

  const { state, reload } = useReport(async (db, business) => {
    const [summary, pl, bs] = await Promise.all([
      getDashboardSummary(db, business.id, range.from, range.to),
      getProfitAndLoss(db, business.id, range.from, range.to),
      getBalanceSheet(db, business.id),
    ]);
    return { summary, pl, bs };
  }, [range.from, range.to]);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ReportState state={state} onRetry={reload}>
        {({ summary, pl, bs }, business) => {
          const net = pl.netProfit;
          const isLoss = net < 0;
          const scale = Math.max(pl.totalIncome, pl.totalExpense, 1);
          return (
            <>
              <View style={s.greet}>
                <Text style={[typo.body, { color: colors.inkSoft }]}>{t('dashboard.greeting')}</Text>
                <Text style={typo.title} numberOfLines={1}>
                  {business.name}
                </Text>
              </View>

              <LedgerHero bad={isLoss}>
                <Text style={[typo.body, { color: colors.onDarkSoft }]}>
                  {isLoss ? t('dashboard.lossThisMonth') : t('dashboard.profitThisMonth')}
                </Text>
                <Text
                  style={[typo.display, { color: colors.onDark }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityLabel={`${isLoss ? t('dashboard.lossThisMonth') : t('dashboard.profitThisMonth')}: ${formatINR(Math.abs(net))}`}
                >
                  {formatINR(Math.abs(net))}
                </Text>
                <Text style={[typo.caption, { color: colors.onDarkSoft }]}>{monthTitle(ref, months)}</Text>

                <View style={s.split}>
                  <SplitLine
                    label={t('dashboard.sales')}
                    value={formatINR(pl.totalIncome)}
                    ratio={pl.totalIncome / scale}
                  />
                  <SplitLine
                    label={t('dashboard.expenses')}
                    value={formatINR(pl.totalExpense)}
                    ratio={pl.totalExpense / scale}
                  />
                </View>
              </LedgerHero>

              <View style={s.grid}>
                <StatTile label={t('dashboard.billsCount')} value={String(summary.totalInvoices)} />
                <StatTile label={t('dashboard.gstCollected')} value={formatINR(summary.totalGst)} />
              </View>
              <View style={s.grid}>
                <StatTile
                  label={t('dashboard.customersOweYou')}
                  value={formatINR(bs.receivables)}
                  tone={bs.receivables > 0 ? 'warn' : 'ink'}
                />
                <StatTile label={t('dashboard.stockValue')} value={formatINR(bs.stockValue)} />
              </View>

              <SectionTitle>{t('dashboard.moreTitle')}</SectionTitle>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <NavRow title={t('tabs.reports')} hint={t('dashboard.reportsHint')} onPress={() => navigate('reports')} />
                <NavRow title={t('tabs.ledger')} hint={t('dashboard.ledgerHint')} onPress={() => navigate('ledger')} />
                <NavRow title={t('profitLoss.title')} hint={t('dashboard.plHint')} onPress={() => navigate('profitLoss')} />
                <NavRow
                  title={t('balanceSheet.title')}
                  hint={t('dashboard.bsHint')}
                  onPress={() => navigate('balanceSheet')}
                />
                <NavRow title={t('tabs.gstr1')} hint={t('dashboard.gstr1Hint')} onPress={() => navigate('gstr1')} />
              </Card>
            </>
          );
        }}
      </ReportState>
    </ScrollView>
  );
}

function SplitLine({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={s.splitText}>
        <Text style={[typo.caption, { color: colors.onDarkSoft }]}>{label}</Text>
        <Text style={[typo.bodyStrong, typo.money, { color: colors.onDark }]}>{value}</Text>
      </View>
      <Meter ratio={ratio} color={colors.turmeric} track="rgba(255,255,255,0.18)" height={6} />
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: space.xl, paddingBottom: space.huge, gap: space.md },
  greet: { marginBottom: space.xs },
  split: { marginTop: space.xl, gap: space.md },
  splitText: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});

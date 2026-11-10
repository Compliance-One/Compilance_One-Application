/**
 * Reports: sales and GST for a chosen period, plus the way into the
 * financial statements.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, typo } from '../../theme';
import { formatDate, formatINR } from '../../lib/format';
import { financialYearRange, monthRange, thisMonthRef, shiftMonth } from '../../lib/periods';
import type { Period } from '../../lib/periods';
import { useReport } from '../../hooks/useReport';
import { getDashboardSummary } from '../../db/views/dashboardSummary';
import {
  AmountRow,
  Card,
  EmptyBlock,
  NavRow,
  ReportState,
  ScreenHeader,
  Segmented,
  SectionTitle,
  StatTile,
} from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

type PeriodKey = 'month' | 'lastMonth' | 'year';

function rangeFor(key: PeriodKey): Period {
  const now = thisMonthRef();
  if (key === 'month') return monthRange(now);
  if (key === 'lastMonth') return monthRange(shiftMonth(now, -1));
  return financialYearRange();
}

export default function ReportsScreen({ navigate }: ScreenProps) {
  const { t } = useTranslation();
  const [key, setKey] = useState<PeriodKey>('month');
  const range = rangeFor(key);

  const { state, reload } = useReport(
    (db, business) => getDashboardSummary(db, business.id, range.from, range.to),
    [range.from, range.to]
  );

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader title={t('reports.title')} />
      <View style={s.controls}>
        <Segmented<PeriodKey>
          value={key}
          onChange={setKey}
          options={[
            { value: 'month', label: t('common.thisMonth') },
            { value: 'lastMonth', label: t('common.lastMonth') },
            { value: 'year', label: t('common.thisYear') },
          ]}
        />
        <Text style={[typo.caption, { color: colors.inkSoft }]}>
          {formatDate(range.from)} – {formatDate(range.to)}
        </Text>
      </View>

      <View style={s.body}>
      <ReportState state={state} onRetry={reload}>
        {(summary) => {
          if (summary.totalInvoices === 0) {
            return <EmptyBlock title={t('reports.emptyTitle')} hint={t('reports.emptyHint')} />;
          }
          const gstMax = Math.max(summary.cgst, summary.sgst, summary.igst, 1);
          return (
            <>
              <View style={s.grid}>
                <StatTile label={t('reports.totalSales')} value={formatINR(summary.totalSales)} />
                <StatTile label={t('reports.bills')} value={String(summary.totalInvoices)} />
              </View>
              <View style={s.grid}>
                <StatTile label={t('reports.taxable')} value={formatINR(summary.taxableAmount)} />
                <StatTile label={t('reports.gstSummary')} value={formatINR(summary.totalGst)} tone="good" />
              </View>

              <SectionTitle>{t('reports.gstSummary')}</SectionTitle>
              <Card>
                <AmountRow label={t('reports.cgst')} value={formatINR(summary.cgst)} ratio={summary.cgst / gstMax} />
                <AmountRow label={t('reports.sgst')} value={formatINR(summary.sgst)} ratio={summary.sgst / gstMax} />
                <AmountRow
                  label={t('reports.igst')}
                  value={formatINR(summary.igst)}
                  ratio={summary.igst / gstMax}
                  barColor={colors.turmeric}
                />
              </Card>
            </>
          );
        }}
      </ReportState>

      <SectionTitle>{t('reports.statements')}</SectionTitle>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <NavRow title={t('profitLoss.title')} hint={t('dashboard.plHint')} onPress={() => navigate('profitLoss')} />
        <NavRow title={t('balanceSheet.title')} hint={t('dashboard.bsHint')} onPress={() => navigate('balanceSheet')} />
      </Card>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: space.huge },
  controls: { paddingHorizontal: space.xl, gap: space.sm, marginBottom: space.lg },
  body: { paddingHorizontal: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
});

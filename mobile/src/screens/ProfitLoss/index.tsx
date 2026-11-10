/**
 * Profit & Loss. Income against expenses, and where each came from.
 * Income is the pre-GST amount: GST you collect is not your income.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, typo } from '../../theme';
import { formatDate, formatINR } from '../../lib/format';
import { financialYearRange, monthRange, shiftMonth, thisMonthRef } from '../../lib/periods';
import type { Period } from '../../lib/periods';
import { useReport } from '../../hooks/useReport';
import { getProfitAndLoss } from '../../db/views/profitLoss';
import { AmountRow, Card, ReportState, ScreenHeader, Segmented, SectionTitle } from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

type PeriodKey = 'month' | 'lastMonth' | 'year';

function rangeFor(key: PeriodKey): Period {
  const now = thisMonthRef();
  if (key === 'month') return monthRange(now);
  if (key === 'lastMonth') return monthRange(shiftMonth(now, -1));
  return financialYearRange();
}

export default function ProfitLossScreen({ back, canGoBack }: ScreenProps) {
  const { t } = useTranslation();
  const [key, setKey] = useState<PeriodKey>('month');
  const range = rangeFor(key);

  const { state, reload } = useReport(
    (db, business) => getProfitAndLoss(db, business.id, range.from, range.to),
    [range.from, range.to]
  );

  // 'sales' is translated; other categories are whatever the owner typed, so just capitalise the first letter.
  const categoryName = (c: string) =>
    c === 'sales' ? t('profitLoss.categorySales') : c.charAt(0).toUpperCase() + c.slice(1);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader title={t('profitLoss.title')} onBack={canGoBack ? back : undefined} />
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

      <ReportState state={state} onRetry={reload}>
        {(pl) => {
          const scale = Math.max(pl.totalIncome, pl.totalExpense, 1);
          const isLoss = pl.netProfit < 0;
          const incomeRows = Object.entries(pl.incomeByCategory).sort((a, b) => b[1] - a[1]);
          const expenseRows = Object.entries(pl.expenseByCategory).sort((a, b) => b[1] - a[1]);

          return (
            <View style={s.body}>
              <View style={[s.result, { backgroundColor: isLoss ? colors.brickTint : colors.leafTint }]}>
                <Text style={[typo.body, { color: isLoss ? colors.brick : colors.leaf }]}>
                  {isLoss ? t('profitLoss.netLoss') : t('profitLoss.netProfit')}
                </Text>
                <Text
                  style={[typo.display, { color: isLoss ? colors.brick : colors.leaf }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatINR(Math.abs(pl.netProfit))}
                </Text>
              </View>

              <Card>
                <AmountRow
                  label={t('profitLoss.income')}
                  value={formatINR(pl.totalIncome)}
                  tone="good"
                  ratio={pl.totalIncome / scale}
                  strong
                />
                <AmountRow
                  label={t('profitLoss.expense')}
                  value={formatINR(pl.totalExpense)}
                  tone="bad"
                  ratio={pl.totalExpense / scale}
                  barColor={colors.brick}
                  strong
                />
                <Text style={[typo.caption, s.note]}>{t('profitLoss.gstNote')}</Text>
              </Card>

              {incomeRows.length > 0 ? (
                <>
                  <SectionTitle>{t('profitLoss.incomeBy')}</SectionTitle>
                  <Card>
                    {incomeRows.map(([name, amount]) => (
                      <AmountRow
                        key={name}
                        label={categoryName(name)}
                        value={formatINR(amount)}
                        ratio={amount / scale}
                      />
                    ))}
                  </Card>
                </>
              ) : null}

              {expenseRows.length > 0 ? (
                <>
                  <SectionTitle>{t('profitLoss.expenseBy')}</SectionTitle>
                  <Card>
                    {expenseRows.map(([name, amount]) => (
                      <AmountRow
                        key={name}
                        label={categoryName(name)}
                        value={formatINR(amount)}
                        ratio={amount / scale}
                        barColor={colors.brick}
                      />
                    ))}
                  </Card>
                </>
              ) : null}

              {incomeRows.length === 0 && expenseRows.length === 0 ? (
                <Text style={[typo.body, s.empty]}>{t('profitLoss.empty')}</Text>
              ) : null}
            </View>
          );
        }}
      </ReportState>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: space.huge },
  controls: { paddingHorizontal: space.xl, gap: space.sm, marginBottom: space.lg },
  body: { paddingHorizontal: space.xl, gap: space.md },
  result: { borderRadius: radius.hero, padding: space.xl, gap: space.xs },
  note: { color: colors.inkFaint, marginTop: space.sm },
  empty: { textAlign: 'center', color: colors.inkSoft, marginTop: space.lg },
});

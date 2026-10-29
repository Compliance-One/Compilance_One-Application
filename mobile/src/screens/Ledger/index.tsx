/**
 * Ledger. A list of customers with what each owes, and a khata-style
 * statement per customer: Billed | Paid | Balance in ruled columns.
 *
 * Sign handling lives in lib/ledger.ts (owedByCustomer).
 */
import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, typo } from '../../theme';
import { formatDate, formatINR } from '../../lib/format';
import { owedByCustomer } from '../../lib/ledger';
import { useReport } from '../../hooks/useReport';
import { getCustomerBalanceList } from '../../db/views/customerList';
import { getCustomerStatement } from '../../db/views/customerBalances';
import type { CustomerBalanceRow } from '../../db/views/customerList';
import { Avatar, Card, EmptyBlock, Pill, ReportState, ScreenHeader } from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

export default function LedgerScreen(_props: ScreenProps) {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  return selected ? (
    <Statement customer={selected} onBack={() => setSelected(null)} />
  ) : (
    <CustomerList onOpen={(c) => setSelected({ id: c.customerId, name: c.name })} />
  );
}

/* ---------------------------- customer list ---------------------------- */

function CustomerList({ onOpen }: { onOpen: (c: CustomerBalanceRow) => void }) {
  const { t } = useTranslation();
  const { state, reload } = useReport((db, business) => getCustomerBalanceList(db, business.id), []);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t('ledger.title')} />
      <ReportState state={state} onRetry={reload}>
        {(customers) => {
          if (customers.length === 0) {
            return <EmptyBlock title={t('ledger.noCustomers')} hint={t('ledger.noCustomersHint')} />;
          }
          const totalOwed = customers.reduce((sum, c) => sum + Math.max(owedByCustomer(c.balance), 0), 0);

          return (
            <FlatList
              data={customers}
              keyExtractor={(c) => c.customerId}
              contentContainerStyle={s.listContent}
              ListHeaderComponent={
                <View style={s.totalCard} accessible accessibilityLabel={`${t('ledger.owedTotal')}: ${formatINR(totalOwed)}`}>
                  <Text style={[typo.body, { color: colors.turmericDeep }]}>{t('ledger.owedTotal')}</Text>
                  <Text style={[typo.display, { color: colors.turmericDeep }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatINR(totalOwed)}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const owed = owedByCustomer(item.balance);
                return (
                  <Pressable
                    onPress={() => onOpen(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${owed === 0 ? t('ledger.settled') : formatINR(Math.abs(owed))}`}
                    style={({ pressed }) => [s.customerRow, pressed && { backgroundColor: colors.leafTint }]}
                  >
                    <Avatar name={item.name} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={typo.bodyStrong} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.phone ? <Text style={[typo.caption, { color: colors.inkFaint }]}>{item.phone}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {owed === 0 ? (
                        <Pill label={t('ledger.settled')} tone="faint" />
                      ) : (
                        <>
                          <Text
                            style={[typo.heading, typo.money, { color: owed > 0 ? colors.turmericDeep : colors.leafMid }]}
                          >
                            {formatINR(Math.abs(owed))}
                          </Text>
                          <Text style={[typo.caption, { color: colors.inkSoft }]}>
                            {owed > 0 ? t('ledger.owesYou') : t('ledger.youOwe')}
                          </Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          );
        }}
      </ReportState>
    </View>
  );
}

/* ------------------------------ statement ------------------------------ */

function Statement({ customer, onBack }: { customer: { id: string; name: string }; onBack: () => void }) {
  const { t } = useTranslation();
  const { state, reload } = useReport(
    (db, business) => getCustomerStatement(db, business.id, customer.id),
    [customer.id]
  );

  const money = (n: number) => (n === 0 ? '—' : formatINR(n));

  return (
    <ScrollView contentContainerStyle={s.stmtContent}>
      <ScreenHeader title={customer.name} onBack={onBack} />
      <ReportState state={state} onRetry={reload}>
        {(entries) => {
          if (entries.length === 0) {
            return <EmptyBlock title={t('ledger.noEntries')} />;
          }
          const last = entries[entries.length - 1];
          const owedNow = owedByCustomer(last.runningBalance);

          return (
            <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
              <View style={s.totalCard}>
                <Text style={[typo.body, { color: colors.turmericDeep }]}>
                  {owedNow >= 0 ? t('ledger.owesYou') : t('ledger.youOwe')}
                </Text>
                <Text style={[typo.display, { color: colors.turmericDeep }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatINR(Math.abs(owedNow))}
                </Text>
              </View>

              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={[s.stmtRow, s.stmtHead]}>
                  <View style={s.colMain} />
                  <NumCell head>{t('ledger.billed')}</NumCell>
                  <NumCell head>{t('ledger.paid')}</NumCell>
                  <NumCell head>{t('ledger.balance')}</NumCell>
                </View>
                {entries.map((e) => (
                  <View key={e.id} style={s.stmtRow}>
                    <View style={s.colMain}>
                      <Text style={typo.bodyStrong} numberOfLines={2}>
                        {e.description || (e.paymentId ? t('ledger.entryPayment') : t('ledger.entryBill'))}
                      </Text>
                      <Text style={[typo.caption, { color: colors.inkFaint }]}>{formatDate(e.entryDate)}</Text>
                    </View>
                    <NumCell>{money(e.debit)}</NumCell>
                    <NumCell tone={colors.leafMid}>{money(e.credit)}</NumCell>
                    <NumCell bold>{formatINR(Math.abs(owedByCustomer(e.runningBalance)))}</NumCell>
                  </View>
                ))}
              </Card>
            </View>
          );
        }}
      </ReportState>
    </ScrollView>
  );
}

/** One ruled number column of the khata page. The cell stretches to the full row height so the rulings run unbroken. */
function NumCell({ children, tone, bold, head }: { children: string; tone?: string; bold?: boolean; head?: boolean }) {
  return (
    <View style={s.cell}>
      <Text
        numberOfLines={1}
        style={head ? [typo.caption, { color: colors.inkSoft }] : [typo.money, s.num, tone ? { color: tone } : null, bold ? { fontWeight: '700' } : null]}
      >
        {children}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  listContent: { paddingHorizontal: space.xl, paddingBottom: space.huge, gap: space.sm },
  totalCard: {
    backgroundColor: colors.turmericTint,
    borderRadius: radius.hero,
    padding: space.xl,
    gap: space.xs,
    marginBottom: space.md,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    minHeight: 68,
  },
  stmtContent: { paddingBottom: space.huge },
  stmtRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  stmtHead: { backgroundColor: colors.paper },
  colMain: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md, justifyContent: 'center' },
  cell: {
    width: 76,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
    paddingHorizontal: space.sm,
    paddingVertical: space.md,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  num: { fontSize: 13, lineHeight: 20, color: colors.ink },
});

/**
 * GSTR-1 export. Pick a month, see what will go in the file and what is
 * missing, make the file on the device (works fully offline), then share it.
 *
 * The file is a DRAFT: its shape has not been validated against the GST
 * offline tool yet, and the screen says so.
 * Sharing uses React Native's built-in Share (text). Saving a real .json file
 * needs expo-file-system, which is not in package.json yet.
 */
import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, typo } from '../../theme';
import { formatINR, pad2 } from '../../lib/format';
import { compareMonth, monthRange, monthTitle, shiftMonth, thisMonthRef } from '../../lib/periods';
import type { MonthRef } from '../../lib/periods';
import { getDb } from '../../db/schema';
import { useReport } from '../../hooks/useReport';
import type { ActiveBusiness } from '../../hooks/useReport';
import { getGstr1Preview } from '../../gstr1/preview';
import { generateGstr1Json } from '../../gstr1/generateGstr1';
import {
  Banner,
  Card,
  MonthStepper,
  PrimaryButton,
  ReportState,
  ScreenHeader,
  SecondaryButton,
  StatTile,
} from '../../components/reports/ui';
import type { ScreenProps } from '../../navigation/types';

interface GeneratedFile {
  fileName: string;
  json: string;
  total: number;
  b2b: number;
  b2c: number;
}

export default function Gstr1ExportScreen(_props: ScreenProps) {
  const { t } = useTranslation();
  const months = t('months', { returnObjects: true }) as unknown as string[];

  // GSTR-1 is filed for the month that just ended, so start there.
  const [ref, setRef] = useState<MonthRef>(() => shiftMonth(thisMonthRef(), -1));
  const [file, setFile] = useState<GeneratedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const range = monthRange(ref);
  const canNext = compareMonth(ref, thisMonthRef()) < 0;

  const { state, reload } = useReport(
    (db, business) => getGstr1Preview(db, business.id, range.from, range.to),
    [range.from, range.to]
  );

  function changeMonth(delta: number) {
    setFile(null);
    setGenError(null);
    setRef((r) => shiftMonth(r, delta));
  }

  async function generate(business: ActiveBusiness) {
    if (!business.gstin) return;
    setBusy(true);
    setGenError(null);
    try {
      const db = await getDb();
      const payload = await generateGstr1Json(db, business.id, business.gstin, range.from, range.to);
      setFile({
        fileName: `GSTR1_${business.gstin}_${pad2(ref.month + 1)}${ref.year}.json`,
        json: JSON.stringify(payload, null, 2),
        total: payload.total_invoices,
        b2b: payload.total_b2b,
        b2c: payload.total_b2c,
      });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!file) return;
    try {
      await Share.share({ title: file.fileName, message: file.json });
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenHeader title={t('gstr1Export.title')} />
      <View style={s.pad}>
        <MonthStepper
          label={monthTitle(ref, months)}
          onPrev={() => changeMonth(-1)}
          onNext={() => changeMonth(1)}
          canNext={canNext}
        />
      </View>

      <ReportState state={state} onRetry={reload}>
        {(preview, business) => {
          const noGstin = !business.gstin;
          const noBills = preview.totalInvoices === 0;
          return (
            <View style={[s.pad, { gap: space.md }]}>
              <View style={s.grid}>
                <StatTile label={t('gstr1Export.totalBills')} value={String(preview.totalInvoices)} />
                <StatTile label={t('gstr1Export.totalTax')} value={formatINR(preview.totalTax)} tone="good" />
              </View>
              <View style={s.grid}>
                <StatTile label={t('gstr1Export.totalB2B')} value={String(preview.b2b)} />
                <StatTile label={t('gstr1Export.totalB2C')} value={String(preview.b2c)} />
              </View>
              <StatTile label={t('gstr1Export.taxable')} value={formatINR(preview.taxableValue)} />

              {noBills ? <Banner tone="info" text={t('gstr1Export.warnNoBills')} /> : null}
              {noGstin ? <Banner tone="warn" text={t('gstr1Export.warnNoGstin')} /> : null}
              {preview.b2bMissingGstin > 0 ? (
                <Banner tone="warn" text={t('gstr1Export.warnB2bMissing', { n: preview.b2bMissingGstin })} />
              ) : null}
              {genError ? <Banner tone="warn" text={genError} /> : null}

              <PrimaryButton
                label={busy ? t('gstr1Export.generating') : t('gstr1Export.generate')}
                onPress={() => generate(business)}
                disabled={noBills || noGstin}
                busy={busy}
              />

              {file ? (
                <Card style={{ gap: space.sm, borderColor: colors.leaf }}>
                  <Text style={[typo.heading, { color: colors.leaf }]}>{t('gstr1Export.readyTitle')}</Text>
                  <Text style={typo.body}>
                    {t('gstr1Export.readyBody', { n: file.total, b2b: file.b2b, b2c: file.b2c })}
                  </Text>
                  <Text style={[typo.caption, { color: colors.inkSoft }]}>{file.fileName}</Text>
                  <Text style={[typo.caption, { color: colors.turmericDeep }]}>{t('gstr1Export.draftNote')}</Text>
                  <View style={{ marginTop: space.sm }}>
                    <SecondaryButton label={t('gstr1Export.share')} onPress={share} />
                  </View>
                </Card>
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
  pad: { paddingHorizontal: space.xl, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});

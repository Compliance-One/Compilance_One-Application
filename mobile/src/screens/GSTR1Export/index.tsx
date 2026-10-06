/**
 * GSTR-1 Export (monthly) — period picker, generates the GSTR-1 JSON fully
 * offline via gstr1/generateGstr1.ts, shows B2B/B2C counts, and offers an
 * Excel export (requires hitting the backend /reports export, or a future
 * on-device Excel generator if that needs to work offline too — confirm
 * with the team which is actually required).
 *
 * TODO (integration): wire db/businessId/gstin context; wire file-save
 * (expo-file-system) for the generated JSON.
 */

import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Gstr1Export } from '../../gstr1/generateGstr1';

export default function Gstr1ExportScreen() {
  const { t } = useTranslation();
  const [result, setResult] = useState<Gstr1Export | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    // TODO: const db = useDb();
    // const json = await generateGstr1Json(db, businessId, gstin, fromDate, toDate);
    // await FileSystem.writeAsStringAsync(path, JSON.stringify(json));
    // setResult(json);
    setGenerating(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('gstr1Export.title')}</Text>
      <Button
        title={generating ? '...' : t('gstr1Export.generate')}
        onPress={handleGenerate}
        disabled={generating}
      />
      {result && (
        <View style={styles.summary}>
          <Text>{t('gstr1Export.totalB2B')}: {result.total_b2b}</Text>
          <Text>{t('gstr1Export.totalB2C')}: {result.total_b2c}</Text>
          <Text style={styles.success}>{t('gstr1Export.generatedSuccess')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  summary: { marginTop: 20 },
  success: { color: '#2a9d4a', marginTop: 8 },
});

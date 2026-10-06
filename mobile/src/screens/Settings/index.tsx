/**
 * Settings — Member 4 owns the Tamil/English language toggle here (i18n
 * scope). Business Profile, Printer Settings, and Backup/Restore belong
 * to other members' scope (business.py/printer/sync) — this screen just
 * reserves the layout slots for them; don't build that logic here.
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const isTamil = i18n.language === 'ta';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <View style={styles.row}>
        <Text>{t('settings.language')}</Text>
        <Switch
          value={isTamil}
          onValueChange={(v) => i18n.changeLanguage(v ? 'ta' : 'en')}
        />
      </View>

      {/* Reserved slots — owned by other members, not Member 4 */}
      <Text style={styles.placeholder}>{t('settings.businessProfile')} (Member 3 scope)</Text>
      <Text style={styles.placeholder}>{t('settings.printerSettings')} (Member 2 scope)</Text>
      <Text style={styles.placeholder}>{t('settings.backupRestore')} (Member 1 scope)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  placeholder: { color: '#aaa', marginTop: 16, fontStyle: 'italic' },
});

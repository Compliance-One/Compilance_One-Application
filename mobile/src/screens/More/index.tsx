/** More: every other screen as a big row, Tamil first. */
import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { logout } from '../../auth/session';
import { font, ListRow, Screen, sp, ui, useBilingual } from '../../ui';

export default function MoreScreen() {
  const { t } = useTranslation();
  const bi = useBilingual();
  const navigation = useNavigation<any>();
  const rows: Array<{ key: string; icon: string; route: string }> = [
    { key: 'more.bills', icon: '🧾', route: 'Invoices' },
    { key: 'more.fullBill', icon: '📝', route: 'InvoiceCreate' },
    { key: 'more.gstJson', icon: '⬇️', route: 'GSTR1Export' },
    { key: 'more.month', icon: '📅', route: 'MonthSummary' },
    { key: 'more.reports', icon: '📊', route: 'Reports' },
    { key: 'more.profit', icon: '📈', route: 'ProfitLoss' },
    { key: 'more.balance', icon: '⚖️', route: 'BalanceSheet' },
    { key: 'more.ledger', icon: '📒', route: 'Ledger' },
    { key: 'more.stock', icon: '🏬', route: 'Inventory' },
    { key: 'more.settings', icon: '⚙️', route: 'Settings' },
  ];
  return (
    <Screen edges={['top']}>
      <Text style={[font.title, { color: ui.text }]}>{t('more.title')}</Text>
      <View style={{ gap: sp.sm }}>
        {rows.map((r) => {
          const [main, sub] = bi(r.key);
          return <ListRow key={r.key} icon={r.icon} title={main} subtitle={sub} onPress={() => navigation.navigate(r.route)} />;
        })}
        <ListRow
          icon="🚪"
          title={bi('more.logout')[0]}
          subtitle={bi('more.logout')[1]}
          onPress={() =>
            Alert.alert(t('more.logout'), t('more.logoutConfirm'), [
              { text: t('common.cancel') },
              { text: t('more.logout'), style: 'destructive', onPress: () => void logout() },
            ])
          }
        />
      </View>
    </Screen>
  );
}

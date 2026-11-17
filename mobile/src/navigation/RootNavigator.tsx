import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MainTabParamList, RootStackParamList, ScreenProps } from './types';
import { useScreenNav } from './useScreenNav';
import { colors } from '../theme';

import DashboardScreen from '../screens/Dashboard';
import ReportsScreen from '../screens/Reports';
import LedgerScreen from '../screens/Ledger';
import Gstr1ExportScreen from '../screens/GSTR1Export';
import SettingsScreen from '../screens/Settings';
import ProfitLossScreen from '../screens/ProfitLoss';
import BalanceSheetScreen from '../screens/BalanceSheet';
import { VoiceBillingScreen } from '../screens/VoiceBilling';
import { InvoiceCreateScreen } from '../screens/InvoiceCreate';
import { InvoicesListScreen } from '../screens/InvoicesList';
import { ProductsScreen } from '../screens/Products';
import { CustomersScreen } from '../screens/Customers';
import { InventoryScreen } from '../screens/Inventory';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function withNav<P extends ScreenProps>(Component: React.ComponentType<P>) {
  return function Wrapped() {
    const nav = useScreenNav();
    return <Component {...(nav as P)} />;
  };
}

const Dashboard = withNav(DashboardScreen);
const Reports = withNav(ReportsScreen);
const Settings = withNav(SettingsScreen);
const Ledger = withNav(LedgerScreen);
const ProfitLoss = withNav(ProfitLossScreen);
const BalanceSheet = withNav(BalanceSheetScreen);
const GSTR1Export = withNav(Gstr1ExportScreen);

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={{
        fontSize: 11,
        fontWeight: focused ? '800' : '600',
        color: focused ? colors.leaf : colors.inkSoft,
      }}
    >
      {label}
    </Text>
  );
}

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.leaf,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={Dashboard}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.home')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="Invoices"
        component={InvoicesListScreen}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.invoices')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="Products"
        component={ProductsScreen}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.products')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="Reports"
        component={Reports}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.reports')} focused={focused} /> }}
      />
      <Tabs.Screen
        name="Settings"
        component={Settings}
        options={{ tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.settings')} focused={focused} /> }}
      />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { t } = useTranslation();
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerBackTitle: t('common.back') }}>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="VoiceBilling"
          component={VoiceBillingScreen}
          options={{ title: t('voiceBilling.title') }}
        />
        <Stack.Screen
          name="InvoiceCreate"
          component={InvoiceCreateScreen}
          options={{ title: t('invoiceCreate.title') }}
        />
        <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: t('customers.title') }} />
        <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: t('inventory.title') }} />
        <Stack.Screen name="Ledger" component={Ledger} options={{ title: t('ledger.title') }} />
        <Stack.Screen name="ProfitLoss" component={ProfitLoss} options={{ title: t('profitLoss.title') }} />
        <Stack.Screen name="BalanceSheet" component={BalanceSheet} options={{ title: t('balanceSheet.title') }} />
        <Stack.Screen name="GSTR1Export" component={GSTR1Export} options={{ title: t('gstr1Export.title') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

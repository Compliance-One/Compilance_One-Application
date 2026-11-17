import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { MainTabParamList, RootStackParamList, ScreenProps } from './types';
import { useScreenNav } from './useScreenNav';
import { colors } from '../theme';
import { NativeHeaderContext } from '../components/reports/ui';
import { InTabContext } from '../ui';

import DashboardScreen from '../screens/Dashboard';
import HomeScreen from '../screens/Home';
import MoreScreen from '../screens/More';
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

/** Report-style screens under a native header: hide their own big title. */
function withNav<P extends ScreenProps>(Component: React.ComponentType<P>) {
  return function Wrapped() {
    const nav = useScreenNav();
    return (
      <NativeHeaderContext.Provider value>
        <Component {...(nav as P)} />
      </NativeHeaderContext.Provider>
    );
  };
}

/** Screens inside a tab: the tab bar already pads the bottom inset. */
function inTab<P extends object>(Component: React.ComponentType<P>) {
  return function TabWrapped(props: P) {
    return (
      <InTabContext.Provider value>
        <Component {...props} />
      </InTabContext.Provider>
    );
  };
}

const Dashboard = withNav(DashboardScreen);
const Reports = withNav(ReportsScreen);
const Settings = withNav(SettingsScreen);
const Ledger = withNav(LedgerScreen);
const ProfitLoss = withNav(ProfitLossScreen);
const BalanceSheet = withNav(BalanceSheetScreen);
const GSTR1Export = withNav(Gstr1ExportScreen);

const HomeTab = inTab(HomeScreen);
const BillTab = inTab(VoiceBillingScreen);
const CreditTab = inTab(CustomersScreen);
const ItemsTab = inTab(ProductsScreen);
const MoreTab = inTab(MoreScreen);

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '🏠',
  Bill: '🧾',
  Credit: '📒',
  Items: '📦',
  More: '☰',
};

function MainTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const label = (key: string) => ({ focused }: { focused: boolean }) => (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={{ fontSize: 13, fontWeight: focused ? '800' : '600', color: focused ? colors.leaf : colors.inkSoft }}
    >
      {t(key)}
    </Text>
  );
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.leaf,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarActiveBackgroundColor: colors.leafTint,
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2, marginVertical: 4 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 66 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 2,
        },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.65 }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tabs.Screen name="Dashboard" component={HomeTab} options={{ tabBarLabel: label('tabs2.home') }} />
      <Tabs.Screen
        name="Bill"
        component={BillTab}
        options={{ tabBarLabel: label('tabs2.bill'), headerShown: true, title: t('voiceBilling.title') }}
      />
      <Tabs.Screen
        name="Credit"
        component={CreditTab}
        options={{ tabBarLabel: label('tabs2.credit'), headerShown: true, title: t('customers.title') }}
      />
      <Tabs.Screen name="Items" component={ItemsTab} options={{ tabBarLabel: label('tabs2.items') }} />
      <Tabs.Screen name="More" component={MoreTab} options={{ tabBarLabel: label('tabs2.more') }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { t } = useTranslation();
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerBackTitle: t('common.back') }}>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="VoiceBilling" component={VoiceBillingScreen} options={{ title: t('voiceBilling.title') }} />
        <Stack.Screen name="InvoiceCreate" component={InvoiceCreateScreen} options={{ title: t('invoiceCreate.title') }} />
        <Stack.Screen name="Invoices" component={InvoicesListScreen} options={{ title: t('tabs.invoices') }} />
        <Stack.Screen name="Reports" component={Reports} options={{ title: t('reports.title') }} />
        <Stack.Screen name="Settings" component={Settings} options={{ title: t('settings.title') }} />
        <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: t('customers.title') }} />
        <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: t('inventory.title') }} />
        <Stack.Screen name="MonthSummary" component={Dashboard} options={{ title: t('dashboard.monthTitle') }} />
        <Stack.Screen name="Ledger" component={Ledger} options={{ title: t('ledger.title') }} />
        <Stack.Screen name="ProfitLoss" component={ProfitLoss} options={{ title: t('profitLoss.title') }} />
        <Stack.Screen name="BalanceSheet" component={BalanceSheet} options={{ title: t('balanceSheet.title') }} />
        <Stack.Screen name="GSTR1Export" component={GSTR1Export} options={{ title: t('gstr1Export.title') }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

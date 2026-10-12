/**
 * A small self-contained navigator for the reports screens, so they are
 * reachable without adding a navigation library. Mount it from the app shell:
 *
 *    import ReportsNavigator from './navigation/ReportsNavigator';
 *    ...
 *    <ReportsNavigator />
 *
 * If the team adopts react-navigation later, register the screens there and
 * delete this file; the screens only use the `navigate` and `back` props.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { BackHandler, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { colors, radius, space, typo } from '../theme';
import type { RouteName, ScreenProps } from './types';
import DashboardScreen from '../screens/Dashboard';
import ReportsScreen from '../screens/Reports';
import LedgerScreen from '../screens/Ledger';
import Gstr1ExportScreen from '../screens/GSTR1Export';
import SettingsScreen from '../screens/Settings';
import ProfitLossScreen from '../screens/ProfitLoss';
import BalanceSheetScreen from '../screens/BalanceSheet';

const TABS = ['dashboard', 'reports', 'ledger', 'gstr1', 'settings'] as const;
type TabName = (typeof TABS)[number];

const SCREENS: Record<RouteName, ComponentType<ScreenProps>> = {
  dashboard: DashboardScreen,
  reports: ReportsScreen,
  ledger: LedgerScreen,
  gstr1: Gstr1ExportScreen,
  settings: SettingsScreen,
  profitLoss: ProfitLossScreen,
  balanceSheet: BalanceSheetScreen,
};

const TAB_LABEL_KEY: Record<TabName, string> = {
  dashboard: 'tabs.home',
  reports: 'tabs.reports',
  ledger: 'tabs.ledger',
  gstr1: 'tabs.gstr1',
  settings: 'tabs.settings',
};

function isTab(route: RouteName): route is TabName {
  return (TABS as ReadonlyArray<string>).includes(route);
}

export default function ReportsNavigator() {
  const { t } = useTranslation();
  const [stack, setStack] = useState<RouteName[]>(['dashboard']);
  const current = stack[stack.length - 1];
  const activeTab = stack[0] as TabName;

  const navigate = useCallback((route: RouteName) => {
    setStack((s) => (isTab(route) ? [route] : [...s, route]));
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  // Android hardware back button: pop a pushed screen first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const Screen = SCREENS[current];

  return (
    <SafeAreaView style={s.root}>
      <View style={s.screen}>
        <Screen navigate={navigate} back={back} canGoBack={stack.length > 1} />
      </View>

      <View style={s.tabBar} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable
              key={tab}
              onPress={() => navigate(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(TAB_LABEL_KEY[tab])}
              style={[s.tab, active && s.tabActive]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[s.tabText, active && s.tabTextActive]}
              >
                {t(TAB_LABEL_KEY[tab])}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: space.xs,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
  },
  tabActive: { backgroundColor: colors.leafTint },
  tabText: { ...typo.caption, fontWeight: '600', color: colors.inkSoft },
  tabTextActive: { color: colors.leaf, fontWeight: '800' },
});

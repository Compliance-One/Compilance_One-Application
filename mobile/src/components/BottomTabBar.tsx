/**
 * BottomTabBar — persistent global tab bar
 * Home | Invoices | 🎙️ (center raised) | Reports | Settings
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

const G_DARK = '#1B5E20';

const TABS = [
  { route: '/dashboard',     icon: '🏠', label: 'Home'     },
  { route: '/invoices',      icon: '📄', label: 'Invoices' },
  { route: '/voice-billing', icon: '🎙️', label: '',       isCenter: true },
  { route: '/reports',       icon: '📊', label: 'Reports'  },
  { route: '/settings',      icon: '⚙️', label: 'Settings' },
];

export function BottomTabBar() {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.route || (tab.route === '/dashboard' && pathname === '/');
          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.route}
                style={styles.centerWrap}
                onPress={() => router.push(tab.route as any)}
                activeOpacity={0.85}
              >
                <View style={styles.centerBtn}>
                  <Text style={styles.centerIcon}>{tab.icon}</Text>
                </View>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tab}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:         { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: Platform.OS === 'ios' ? 16 : 4, elevation: 20, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
  bar:             { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, height: 60 },
  tab:             { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative' },
  tabIcon:         { fontSize: 22 },
  tabIconActive:   {},
  tabLabel:        { fontSize: 10, color: '#9E9E9E', fontWeight: '600' },
  tabLabelActive:  { color: G_DARK, fontWeight: '800' },
  activeIndicator: { position: 'absolute', top: -8, width: 4, height: 4, borderRadius: 2, backgroundColor: G_DARK },
  centerWrap:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  centerBtn:       { width: 58, height: 58, borderRadius: 29, backgroundColor: G_DARK, alignItems: 'center', justifyContent: 'center', marginBottom: 2, elevation: 8, shadowColor: G_DARK, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, borderWidth: 3, borderColor: '#fff' },
  centerIcon:      { fontSize: 24 },
});

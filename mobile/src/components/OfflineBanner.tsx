/**
 * Member 3 — Shared Components
 * mobile/src/components/OfflineBanner.tsx
 *
 * Sticky banner shown at the top of every screen when the device is offline.
 * Reads from Zustand isOffline state.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export function OfflineBanner() {
  const isOffline        = useAppStore((s) => s.isOffline);
  const pendingSyncCount = useAppStore((s) => s.pendingSyncCount);

  if (!isOffline) return null;

  const syncText = pendingSyncCount > 0
    ? `${pendingSyncCount} change${pendingSyncCount > 1 ? 's' : ''} pending sync`
    : 'Data saves locally';

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>📶</Text>
      <View style={styles.textGroup}>
        <Text style={styles.title}>Offline Mode</Text>
        <Text style={styles.subtitle}>{syncText} — will sync when connected</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F57F17',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    color: '#FFF9C4',
    fontSize: 11,
    marginTop: 1,
  },
});

import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { initDatabase } from '../src/db/client';
import { startNetListener, stopNetListener } from '../src/sync/netListener';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAppStore } from '../src/store/useAppStore';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { usePathname } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';

function generateId(): string {
  try {
    return uuidv4();
  } catch {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }
}

const G_DARK = '#1B5E20';

// Screens that show the bottom tab bar
const TAB_ROUTES = ['/dashboard', '/invoices', '/voice-billing', '/reports', '/settings', '/'];

function AppShell() {
  const pathname = usePathname();
  const showTab  = TAB_ROUTES.includes(pathname);

  return (
    <View style={styles.shell}>
      <Stack
        screenOptions={{
          headerShown: false,   // Each screen manages its own header
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="voice-billing" />
        <Stack.Screen name="invoice-create" />
        <Stack.Screen name="invoices" />
        <Stack.Screen name="products" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="inventory" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="ledger" />
        <Stack.Screen name="profit-loss" />
        <Stack.Screen name="balance-sheet" />
        <Stack.Screen name="gstr1-export" />
        <Stack.Screen name="settings" />
      </Stack>
      {showTab && <BottomTabBar />}
    </View>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const setSession = useAppStore(s => s.setSession);
  const business   = useAppStore(s => s.business);

  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
        try { startNetListener(); } catch { /* web doesn't support NetInfo */ }
        
        // Auto-login demo session
        if (!business) {
          setSession(
            { id: '1', name: 'Demo User', phone: '9999999999', email: 'demo@example.com', passwordHash: 'hash', createdAt: '', updatedAt: '' },
            { id: 'demo-biz', ownerUserId: '1', businessName: 'Compliance Store', gstin: '33ABCDE1234F1Z5', voiceLanguage: 'ta', offlineMode: true, phone: '9840123456', address: 'Chennai, Tamil Nadu', stateCode: '33', financialYearStart: '2024-04-01', printerSettings: null, createdAt: '', updatedAt: '' },
            'mock-jwt-token',
          );
        }
        setDbReady(true);
      } catch (e: any) {
        console.error('DB Init failed', e);
        setInitError(e?.message ?? 'Startup error');
        setDbReady(true); // show app anyway
      }
    }
    setup();

    return () => {
      try { stopNetListener(); } catch { /* web */ }
    };
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Compliance One</Text>
        <Text style={styles.splashSub}>GST Voice Billing</Text>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return <AppShell />;
}

const styles = StyleSheet.create({
  shell:       { flex: 1 },
  splash:      { flex: 1, backgroundColor: G_DARK, alignItems: 'center', justifyContent: 'center' },
  splashTitle: { fontSize: 32, fontWeight: '900', color: '#fff' },
  splashSub:   { fontSize: 16, color: '#A5D6A7', marginTop: 8 },
});

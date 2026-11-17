import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { bootstrapApp } from './src/bootstrap/appBootstrap';
import RootNavigator from './src/navigation/RootNavigator';
import './src/i18n';
import { colors, typo } from './src/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        cleanup = await bootstrapApp();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!ready ? (
          <View style={styles.boot}>
            {error ? (
              <Text style={[typo.body, { color: colors.brick, textAlign: 'center' }]}>{error}</Text>
            ) : (
              <ActivityIndicator size="large" color={colors.leaf} />
            )}
          </View>
        ) : (
          <RootNavigator />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

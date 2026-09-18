/**
 * Member 1 — Sync Layer
 * mobile/src/sync/netListener.ts
 *
 * Listens for network connectivity changes and triggers
 * sync when the device comes back online.
 * Updates Zustand isOffline state.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAppStore } from '../store/useAppStore';
import { drain } from './syncManager';

let _unsubscribe: (() => void) | null = null;

/**
 * Start listening for connectivity changes.
 * Call once from app root (e.g. _layout.tsx or App.tsx).
 */
export function startNetListener(): void {
  if (_unsubscribe) return; // already listening

  _unsubscribe = NetInfo.addEventListener(handleNetChange);

  // Check current state immediately on start
  NetInfo.fetch().then(handleNetChange);
}

/**
 * Stop the listener (call on app unmount if needed).
 */
export function stopNetListener(): void {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

async function handleNetChange(state: NetInfoState): Promise<void> {
  const isOffline = !(state.isConnected && state.isInternetReachable);
  const wasOffline = useAppStore.getState().isOffline;

  // Update Zustand store
  useAppStore.getState().setOffline(isOffline);

  // If we just came BACK online → trigger sync drain
  if (wasOffline && !isOffline) {
    console.log('[NetListener] Connection restored — starting sync drain');
    try {
      await drain();
    } catch (err) {
      console.warn('[NetListener] Sync drain failed after reconnect:', err);
    }
  }
}

/**
 * Returns current connectivity status (one-shot, not reactive).
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
}

import { hydrateAuth, installRefreshHandler } from '../auth/session';
import { getDb } from '../db/schema';
import { hydrateLanguage } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { startRuntimeSync, stopRuntimeSync } from '../sync/lifecycle';
import { NetworkListener } from '../sync/netListener';

/**
 * Opens SQLite (running migrations), hydrates auth + the active business into
 * the Zustand store when a session exists, starts the network listener, and
 * starts the sync loop only after the user is authenticated.
 */
export async function bootstrapApp(): Promise<() => void> {
  await hydrateLanguage();
  await getDb();
  installRefreshHandler();
  const authed = await hydrateAuth();

  const listener = new NetworkListener();
  const current = await listener.checkCurrentStatus();
  useAppStore.getState().setOnlineStatus(current);
  listener.startListening((isOnline, networkType) => {
    useAppStore.getState().setOnlineStatus(isOnline, networkType);
  });

  if (authed) await startRuntimeSync();

  return () => {
    stopRuntimeSync();
    listener.stopListening();
  };
}

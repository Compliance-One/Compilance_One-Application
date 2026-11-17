import { getDb } from '../db/schema';
import { seedDefaultBusiness } from '../db/repositories';
import { hydrateLanguage } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { NetworkListener } from '../sync/netListener';
import { startSyncLoop } from '../sync/syncManager';

/**
 * Opens SQLite (running migrations), hydrates the active business into the
 * Zustand store, starts the network listener and the sync loop.
 * Returns a cleanup function that stops both background tasks.
 */
export async function bootstrapApp(): Promise<() => void> {
  await hydrateLanguage();
  const db = await getDb();
  const business = await seedDefaultBusiness(db);
  useAppStore.getState().setBusiness({
    id: business.id,
    name: business.name,
    gstin: business.gstin ?? undefined,
    stateCode: business.stateCode,
  });

  const listener = new NetworkListener();
  const current = await listener.checkCurrentStatus();
  useAppStore.getState().setOnlineStatus(current);
  listener.startListening((isOnline, networkType) => {
    useAppStore.getState().setOnlineStatus(isOnline, networkType);
  });

  const stopSync = startSyncLoop(
    db,
    () => useAppStore.getState().business?.id ?? null,
    (count) => {
      useAppStore.getState().setPendingSyncCount(count);
      if (count === 0) useAppStore.getState().setLastSyncedAt(new Date().toISOString());
    }
  );

  return () => {
    stopSync();
    listener.stopListening();
  };
}

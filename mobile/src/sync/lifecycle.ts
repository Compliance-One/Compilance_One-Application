import { getDb } from '../db/schema';
import { useAppStore } from '../store/useAppStore';
import { OutboxRepository } from './outbox';
import { startSyncLoop } from './syncManager';

let stop: (() => void) | null = null;

export async function startRuntimeSync(): Promise<void> {
  if (stop) return;
  const db = await getDb();
  stop = startSyncLoop(
    db,
    () => useAppStore.getState().business?.id ?? null,
    (count) => {
      useAppStore.getState().setPendingSyncCount(count);
      if (count === 0) useAppStore.getState().setLastSyncedAt(new Date().toISOString());
    }
  );
  const pending = await new OutboxRepository(db).countPending();
  useAppStore.getState().setPendingSyncCount(pending);
}

export function stopRuntimeSync(): void {
  stop?.();
  stop = null;
}

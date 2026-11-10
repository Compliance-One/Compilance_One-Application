import { useEffect, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '../db/schema';

export interface ActiveBusiness {
  id: string;
  name: string;
  gstin: string | null;
}

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; data: T; business: ActiveBusiness };

/**
 * TODO (integration): the active business should come from Member 3's
 * Zustand store (session / active business). Until that exists, use the
 * first business stored on this device.
 */
async function loadActiveBusiness(db: SQLiteDatabase): Promise<ActiveBusiness | null> {
  const row = await db.getFirstAsync<{ id: string; business_name: string; gstin: string | null }>(
    'SELECT id, business_name, gstin FROM businesses ORDER BY created_at LIMIT 1'
  );
  return row ? { id: row.id, name: row.business_name, gstin: row.gstin } : null;
}

/**
 * Loads report data from local SQLite. Always queries fresh (nothing is
 * cached), and keeps showing the previous numbers while a new period loads.
 */
export function useReport<T>(
  loader: (db: SQLiteDatabase, business: ActiveBusiness) => Promise<T>,
  deps: ReadonlyArray<unknown>
): { state: AsyncState<T>; reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));

    (async () => {
      try {
        const db = await getDb();
        const business = await loadActiveBusiness(db);
        if (!business) {
          if (!cancelled) setState({ status: 'empty' });
          return;
        }
        const data = await loaderRef.current(db, business);
        if (!cancelled) setState({ status: 'ready', data, business });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { state, reload: () => setTick((n) => n + 1) };
}

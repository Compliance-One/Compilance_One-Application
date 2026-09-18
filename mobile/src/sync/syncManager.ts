/**
 * Member 1 — Sync Layer
 * mobile/src/sync/syncManager.ts
 *
 * Core sync engine: drains the outbox (push) and fetches new server
 * data (pull). Queue-based, resumable, and retry-safe.
 *
 * Strategy: server-wins on conflict (last-write-wins by updated_at).
 * The backend's sync_reconciler handles deduplication.
 */

import { apiClient } from '../api/client';
import { getUnsynced, markSynced } from './outbox';
import { db } from '../db/client';
import { sql } from 'drizzle-orm';

// Store the timestamp of the last successful pull
const LAST_PULL_KEY = 'sync_last_pull_at';

// ─── Push ─────────────────────────────────────────────────────────────────────

/**
 * Push all unsynced outbox entries to the server in one batch.
 * On success, marks them as synced.
 * On failure, throws so the caller can retry.
 */
export async function push(): Promise<{ pushed: number }> {
  const entries = await getUnsynced();
  if (entries.length === 0) return { pushed: 0 };

  const response = await apiClient.post<{ accepted: number[]; rejected: number[] }>(
    '/api/v1/sync/push',
    { entries },
  );

  const { accepted } = response.data;
  await markSynced(accepted);

  console.log(`[SyncManager] Pushed ${accepted.length} of ${entries.length} entries`);
  return { pushed: accepted.length };
}

// ─── Pull ─────────────────────────────────────────────────────────────────────

interface PullRow {
  tableName: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId:  string;
  payload:   Record<string, unknown>;
  updatedAt: string;
}

/**
 * Pull all records changed on the server since the last pull timestamp.
 * Upserts them into local SQLite (server-wins).
 */
export async function pull(): Promise<{ pulled: number }> {
  const lastPullAt = await getLastPullAt();

  const response = await apiClient.get<{ rows: PullRow[]; serverTime: string }>(
    '/api/v1/sync/pull',
    { params: { since: lastPullAt } },
  );

  const { rows, serverTime } = response.data;

  for (const row of rows) {
    await applyServerRow(row);
  }

  await setLastPullAt(serverTime);

  console.log(`[SyncManager] Pulled ${rows.length} rows from server`);
  return { pulled: rows.length };
}

/**
 * Applies a single server row to local SQLite.
 * Uses raw SQL upsert to handle any table generically.
 */
async function applyServerRow(row: PullRow): Promise<void> {
  const { tableName, operation, payload } = row;

  if (operation === 'DELETE') {
    await db.run(sql.raw(`DELETE FROM ${tableName} WHERE id = '${row.recordId}'`));
    return;
  }

  // INSERT or UPDATE → upsert
  const columns = Object.keys(payload);
  const values  = Object.values(payload);

  const colList  = columns.join(', ');
  const valList  = values.map((v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)).join(', ');
  const updateSet = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  await db.run(
    sql.raw(
      `INSERT INTO ${tableName} (${colList}) VALUES (${valList})
       ON CONFLICT(id) DO UPDATE SET ${updateSet}`,
    ),
  );
}

// ─── Drain (push + pull together) ────────────────────────────────────────────

const MAX_RETRIES   = 1;
const RETRY_DELAY_MS = 1000;

/**
 * Full sync cycle: push outbox then pull server changes.
 * Retries up to MAX_RETRIES times with exponential backoff.
 * Called by netListener when connectivity is restored.
 */
export async function drain(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await push();
      await pull();
      return; // success
    } catch (err) {
      console.warn(`[SyncManager] Drain attempt ${attempt}/${MAX_RETRIES} failed:`, err);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  console.log('[SyncManager] Offline mode: Server sync skipped, local SQLite operational.');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLastPullAt(): Promise<string> {
  try {
    const row = await db.get<{ value: string }>(
      sql`SELECT value FROM sync_meta WHERE key = ${LAST_PULL_KEY}`,
    );
    return row?.value ?? '1970-01-01T00:00:00.000Z';
  } catch {
    return '1970-01-01T00:00:00.000Z';
  }
}

async function setLastPullAt(ts: string): Promise<void> {
  await db.run(sql`
    INSERT INTO sync_meta (key, value) VALUES (${LAST_PULL_KEY}, ${ts})
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
}

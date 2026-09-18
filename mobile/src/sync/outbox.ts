/**
 * Member 1 — Sync Layer
 * mobile/src/sync/outbox.ts
 *
 * Append-only outbox queue. Every local write (INSERT/UPDATE/DELETE)
 * is recorded here so the sync manager can push it to the server
 * when connectivity is restored.
 */

import { db } from '../db/client';
import { syncOutbox } from '../db/schema';
import { isNull, eq, inArray } from 'drizzle-orm';

export type OutboxOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OutboxEntry {
  id:        number;
  tableName: string;
  operation: OutboxOperation;
  recordId:  string;
  payload:   Record<string, unknown>;
  createdAt: string;
}

/**
 * Appends a new entry to the outbox queue.
 * Call this inside every DB write transaction.
 *
 * @param tableName  e.g. 'invoices'
 * @param operation  'INSERT' | 'UPDATE' | 'DELETE'
 * @param recordId   UUID of the affected row
 * @param payload    Full row data (for INSERT/UPDATE) or { id } (for DELETE)
 */
export async function enqueue(
  tableName: string,
  operation: OutboxOperation,
  recordId:  string,
  payload:   Record<string, unknown>,
): Promise<void> {
  await db.insert(syncOutbox).values({
    tableName,
    operation,
    recordId,
    payload: payload as any,
  });
}

/**
 * Returns all outbox entries that have not yet been synced (synced_at IS NULL).
 * Called by syncManager before each push attempt.
 */
export async function getUnsynced(): Promise<OutboxEntry[]> {
  const rows = await db
    .select()
    .from(syncOutbox)
    .where(isNull(syncOutbox.syncedAt))
    .orderBy(syncOutbox.createdAt);

  return rows.map((r) => ({
    id:        r.id,
    tableName: r.tableName,
    operation: r.operation as OutboxOperation,
    recordId:  r.recordId,
    payload:   r.payload as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}

/**
 * Marks a batch of outbox entries as synced.
 * Called after the server confirms receipt.
 *
 * @param ids  Array of outbox row IDs (integer primary keys)
 */
export async function markSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  await db
    .update(syncOutbox)
    .set({ syncedAt: now })
    .where(inArray(syncOutbox.id, ids));
}

/**
 * Returns count of pending (unsynced) entries.
 * Used by the offline banner to show "X changes pending sync".
 */
export async function pendingCount(): Promise<number> {
  const rows = await db
    .select({ id: syncOutbox.id })
    .from(syncOutbox)
    .where(isNull(syncOutbox.syncedAt));
  return rows.length;
}

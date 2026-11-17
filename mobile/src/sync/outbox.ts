import type { SQLiteDatabase } from 'expo-sqlite';
import { CONFIG } from '../config/env';

export type OutboxOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OutboxItem {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: OutboxOperation;
  payload: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export class OutboxRepository {
  constructor(private db: SQLiteDatabase) {}

  async enqueue(
    entityType: string,
    entityId: string,
    operation: OutboxOperation,
    data: Record<string, unknown>
  ): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [entityType, entityId, operation, JSON.stringify(data)]
    );
    return Number(result.lastInsertRowId);
  }

  async recoverStuckProcessing(timeoutSeconds: number = 60): Promise<void> {
    // Compare timestamps entirely in SQLite so ISO vs CURRENT_TIMESTAMP formats cannot misfire.
    await this.db.runAsync(
      `UPDATE outbox
       SET status = 'FAILED',
           attempts = attempts + 1,
           last_error = 'Processing timeout recovery',
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'PROCESSING'
         AND datetime(updated_at) < datetime('now', ?);`,
      [`-${timeoutSeconds} seconds`]
    );
  }

  async getPendingBatch(limit: number = 50): Promise<OutboxItem[]> {
    await this.recoverStuckProcessing(60);
    return await this.db.getAllAsync<OutboxItem>(
      `SELECT * FROM outbox
       WHERE status IN ('PENDING', 'FAILED') AND attempts < ?
       ORDER BY id ASC LIMIT ?;`,
      [CONFIG.MAX_RETRY_COUNT, limit]
    );
  }

  async markProcessing(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE outbox
       SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders});`,
      ids
    );
  }

  async markProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE outbox
       SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders});`,
      ids
    );
  }

  async markBatchFailed(ids: number[], errorMessage: string): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE outbox
       SET status = 'FAILED',
           attempts = attempts + 1,
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders});`,
      [errorMessage, ...ids]
    );
  }

  /**
   * Give every FAILED item (including ones that exhausted MAX_RETRY_COUNT) a fresh start.
   * Used after the server has accepted the business: earlier child items were rejected
   * only because the business did not exist yet.
   */
  async requeueFailed(): Promise<number> {
    const result = await this.db.runAsync(
      `UPDATE outbox
       SET status = 'PENDING', attempts = 0, updated_at = CURRENT_TIMESTAMP
       WHERE status = 'FAILED';`
    );
    return result.changes ?? 0;
  }

  /** Like requeueFailed, but leaves the given outbox ids (this round's fresh failures) as FAILED. */
  async requeueFailedExcept(keepIds: number[]): Promise<void> {
    const guard = keepIds.length ? ` AND id NOT IN (${keepIds.map(() => '?').join(',')})` : '';
    await this.db.runAsync(
      `UPDATE outbox
       SET status = 'PENDING', attempts = 0, updated_at = CURRENT_TIMESTAMP
       WHERE status = 'FAILED'${guard};`,
      keepIds
    );
  }

  /** Drop unsent/failed items for one entity so a fresh snapshot can replace them. */
  async discardUnsent(entityType: string, entityId: string): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM outbox
       WHERE entity_type = ? AND entity_id = ? AND status IN ('PENDING', 'FAILED');`,
      [entityType, entityId]
    );
  }

  async countPending(): Promise<number> {
    const row = await this.db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM outbox
       WHERE status IN ('PENDING', 'FAILED', 'PROCESSING') AND attempts < ?`,
      [CONFIG.MAX_RETRY_COUNT]
    );
    return row?.c ?? 0;
  }

  async pendingEntityIds(): Promise<Set<string>> {
    const rows = await this.db.getAllAsync<{ entity_id: string }>(
      `SELECT DISTINCT entity_id FROM outbox
       WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')`
    );
    return new Set(rows.map((r) => r.entity_id));
  }
}

import * as SQLite from 'expo-sqlite';

export interface OutboxItem {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  created_at: string;
  status: 'PENDING' | 'PROCESSING' | 'FAILED';
  attempts: number;
}

export class OutboxManager {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async enqueue(
    entityType: string,
    entityId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO outbox (entity_type, entity_id, operation, payload, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [entityType, entityId, operation, JSON.stringify(payload)]
    );
  }

  async getPendingBatch(limit = 50): Promise<OutboxItem[]> {
    return await this.db.getAllAsync<OutboxItem>(
      `SELECT * FROM outbox 
       WHERE status = 'PENDING' OR (status = 'FAILED' AND attempts < 5)
       ORDER BY id ASC LIMIT ?`,
      [limit]
    );
  }

  async markProcessing(ids: number[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE outbox SET status = 'PROCESSING' WHERE id IN (${placeholders})`,
      ids
    );
  }

  async markResolved(ids: number[]): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `DELETE FROM outbox WHERE id IN (${placeholders})`,
      ids
    );
  }

  async markFailed(id: number): Promise<void> {
    await this.db.runAsync(
      `UPDATE outbox 
       SET status = 'FAILED', attempts = attempts + 1 
       WHERE id = ?`,
      [id]
    );
  }
}

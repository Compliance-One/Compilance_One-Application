import { SQLiteDatabase } from 'expo-sqlite';

export interface OutboxItem {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export class OutboxRepository {
  constructor(private db: SQLiteDatabase) {}

  async recoverStuckProcessing(timeoutSeconds: number = 60): Promise<void> {
    const threshold = new Date(Date.now() - timeoutSeconds * 1000).toISOString();
    await this.db.runAsync(
      `UPDATE sync_outbox 
       SET status = 'FAILED', 
           retry_count = retry_count + 1,
           last_error = 'Processing timeout recovery',
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'PROCESSING' AND updated_at < ?;`,
      [threshold]
    );
  }

  async getPendingBatch(limit: number = 50): Promise<OutboxItem[]> {
    await this.recoverStuckProcessing(60);
    return await this.db.getAllAsync<OutboxItem>(
      `SELECT * FROM sync_outbox 
       WHERE status IN ('PENDING', 'FAILED') AND retry_count < 5 
       ORDER BY id ASC LIMIT ?;`,
      [limit]
    );
  }

  async markProcessing(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE sync_outbox 
       SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      ids
    );
  }

  async markProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE sync_outbox 
       SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      ids
    );
  }

  async markBatchFailed(ids: number[], errorMessage: string): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE sync_outbox 
       SET status = 'FAILED', 
           retry_count = retry_count + 1, 
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id IN (${placeholders});`,
      [errorMessage, ...ids]
    );
  }
}

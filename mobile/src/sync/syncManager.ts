import { OutboxRepository, OutboxItem } from './outbox';
import { ApiClient, SyncPushItem } from './client';

export class SyncManager {
  private isSyncing = false;

  constructor(
    private outbox: OutboxRepository,
    private client: ApiClient
  ) {}

  async processSync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    let batch: OutboxItem[] = [];
    try {
      batch = await this.outbox.getPendingBatch(50);
      if (batch.length === 0) {
        this.isSyncing = false;
        return;
      }

      const batchIds = batch.map((item) => item.id);
      await this.outbox.markProcessing(batchIds);

      const pushItems: SyncPushItem[] = batch.map((item) => ({
        outbox_id: item.id,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        operation: item.operation,
        data: JSON.parse(item.payload),
      }));

      const response = await this.client.pushSync(pushItems);

      if (response.processed_ids.length > 0) {
        await this.outbox.markProcessed(response.processed_ids);
      }
      if (response.failed_ids.length > 0) {
        await this.outbox.markBatchFailed(response.failed_ids, 'Reconciler rejected item');
      }
    } catch (error: any) {
      if (batch.length > 0) {
        await this.outbox.markBatchFailed(
          batch.map((b) => b.id),
          error?.message || 'Network sync failure'
        );
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

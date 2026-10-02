import { OutboxManager, OutboxItem } from './outbox';
import { NetworkListener } from './netListener';
import { ApiClient } from '../api/client';

export class SyncManager {
  private isSyncing = false;

  constructor(
    private outbox: OutboxManager,
    private netListener: NetworkListener,
    private api: ApiClient
  ) {}

  init(): void {
    this.netListener.startListening(async (isOnline) => {
      if (isOnline) {
        await this.syncPending();
      }
    });
  }

  async syncPending(): Promise<void> {
    if (this.isSyncing) return;

    const isOnline = await this.netListener.checkCurrentStatus();
    if (!isOnline) return;

    this.isSyncing = true;

    try {
      const batch = await this.outbox.getPendingBatch(50);
      if (!batch.length) {
        this.isSyncing = false;
        return;
      }

      const itemIds = batch.map((item) => item.id);
      await this.outbox.markProcessing(itemIds);

      const payload = {
        items: batch.map((item: OutboxItem) => ({
          outbox_id: item.id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          operation: item.operation,
          data: JSON.parse(item.payload),
        })),
      };

      const result = await this.api.pushBatch(payload);

      if (result.processed_ids?.length) {
        await this.outbox.markResolved(result.processed_ids);
      }

      if (result.failed_ids?.length) {
        for (const failedId of result.failed_ids) {
          await this.outbox.markFailed(failedId);
        }
      }
    } catch {
      // Revert processing items on network crash so they can retry
      const batch = await this.outbox.getPendingBatch(50);
      for (const item of batch) {
        await this.outbox.markFailed(item.id);
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

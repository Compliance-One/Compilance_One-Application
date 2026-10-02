import { CONFIG } from '../config/env';

export interface SyncPushItem {
  outbox_id: number;
  entity_type: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, any>;
}

export interface SyncPushResponse {
  processed_ids: number[];
  failed_ids: number[];
}

export class SyncClient {
  private baseUrl: string;

  constructor(baseUrl: string = CONFIG.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async pushSync(items: SyncPushItem[]): Promise<SyncPushResponse> {
    const response = await fetch(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sync Push failed (${response.status}): ${errText}`);
    }

    return await response.json();
  }
}

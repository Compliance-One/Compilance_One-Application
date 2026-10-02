const BASE_URL = 'http://10.0.2.2:8000/api/v1'; // 10.0.2.2 points to host machine from Android emulator

export interface SyncPayload {
  items: Array<{
    outbox_id: number;
    entity_type: string;
    entity_id: string;
    operation: string;
    data: Record<string, unknown>;
  }>;
}

export interface SyncResponse {
  processed_ids: number[];
  failed_ids: number[];
}

export class ApiClient {
  private token: string | null = null;

  setAuthToken(token: string): void {
    this.token = token;
  }

  async pushBatch(payload: SyncPayload): Promise<SyncResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Sync failed with HTTP status ${response.status}`);
    }

    return await response.json();
  }
}

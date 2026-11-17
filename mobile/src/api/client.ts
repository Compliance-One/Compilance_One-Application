import { CONFIG } from '../config/env';

export interface SyncPushItem {
  outbox_id: number;
  entity_type: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
}

export interface SyncPushResponse {
  processed_ids: number[];
  failed_ids: number[];
}

export interface SyncPullResponse {
  server_time: string;
  changes: Record<string, Array<Record<string, unknown>>>;
}

export class ApiClient {
  private token: string | null = null;
  constructor(private baseUrl: string = CONFIG.API_BASE_URL) {}

  setAuthToken(token: string | null): void {
    this.token = token;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async pushSync(items: SyncPushItem[]): Promise<SyncPushResponse> {
    const response = await fetch(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ items }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sync Push failed (${response.status}): ${errText}`);
    }
    return (await response.json()) as SyncPushResponse;
  }

  async pullSync(businessId: string, sinceIsoString?: string): Promise<SyncPullResponse> {
    let url = `${this.baseUrl}/sync/pull?business_id=${encodeURIComponent(businessId)}`;
    if (sinceIsoString) url += `&since=${encodeURIComponent(sinceIsoString)}`;
    const response = await fetch(url, { method: 'GET', headers: this.headers() });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sync Pull failed (${response.status}): ${errText}`);
    }
    return (await response.json()) as SyncPullResponse;
  }
}

export const apiClient = new ApiClient();

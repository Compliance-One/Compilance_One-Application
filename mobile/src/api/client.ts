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

type RequestInitWithJson = RequestInit & { json?: unknown };

export class ApiClient {
  private token: string | null = null;
  private refreshHandler: (() => Promise<boolean>) | null = null;

  constructor(private baseUrl: string = CONFIG.API_BASE_URL) {}

  setAuthToken(token: string | null): void {
    this.token = token;
  }

  setRefreshHandler(handler: (() => Promise<boolean>) | null): void {
    this.refreshHandler = handler;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async request(path: string, init: RequestInitWithJson = {}, retried = false): Promise<Response> {
    const headers = { ...this.headers(), ...(init.headers as Record<string, string> | undefined) };
    const body = init.json !== undefined ? JSON.stringify(init.json) : init.body;
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, body: body as BodyInit | undefined });
    const skipRefresh =
      path.includes('/auth/refresh') ||
      path.includes('/auth/login') ||
      path.includes('/auth/register');
    if (response.status === 401 && !retried && !skipRefresh && this.refreshHandler) {
      const ok = await this.refreshHandler();
      if (ok) return this.request(path, init, true);
    }
    return response;
  }

  async requestJson<T>(path: string, init: RequestInitWithJson = {}): Promise<T> {
    const response = await this.request(path, init);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${errText}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async pushSync(items: SyncPushItem[]): Promise<SyncPushResponse> {
    const response = await this.request('/sync/push', {
      method: 'POST',
      json: { items },
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sync Push failed (${response.status}): ${errText}`);
    }
    return (await response.json()) as SyncPushResponse;
  }

  async pullSync(businessId: string, sinceIsoString?: string): Promise<SyncPullResponse> {
    let url = `/sync/pull?business_id=${encodeURIComponent(businessId)}`;
    if (sinceIsoString) url += `&since=${encodeURIComponent(sinceIsoString)}`;
    const response = await this.request(url, { method: 'GET' });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sync Pull failed (${response.status}): ${errText}`);
    }
    return (await response.json()) as SyncPullResponse;
  }
}

export const apiClient = new ApiClient();

import type { SQLiteDatabase } from 'expo-sqlite';
import { apiClient } from '../api/client';
import { CONFIG } from '../config/env';
import { OutboxRepository, type OutboxItem } from './outbox';

/** Must match backend ENTITY_PRIORITY so FKs resolve on the server. */
export const ENTITY_PRIORITY: string[] = [
  'users',
  'businesses',
  'products',
  'customers',
  'invoices',
  'invoice_items',
  'payments',
  'ledger_entries',
  'expenses',
  'suppliers',
  'purchases',
  'voice_transaction_logs',
  'gstr1_exports',
];

/**
 * Only send columns the backend model knows about. Local-only fields
 * (due_date, state_code, sku, email on customers, etc.) stay on device.
 */
const SYNC_FIELDS: Record<string, string[]> = {
  users: ['id', 'name', 'phone', 'email', 'password_hash', 'created_at'],
  businesses: [
    'id',
    'owner_user_id',
    'business_name',
    'gstin',
    'address',
    'phone',
    'financial_year_start',
    'voice_language',
    'offline_mode',
    'printer_settings',
    'opening_cash_balance',
    'opening_bank_balance',
    'created_at',
  ],
  products: [
    'id',
    'business_id',
    'name',
    'hsn_code',
    'gst_rate',
    'unit',
    'price',
    'stock_quantity',
    'created_at',
  ],
  customers: ['id', 'business_id', 'name', 'phone', 'address', 'gstin', 'customer_type', 'created_at'],
  invoices: [
    'id',
    'business_id',
    'customer_id',
    'invoice_number',
    'invoice_date',
    'invoice_type',
    'subtotal',
    'discount',
    'taxable_amount',
    'cgst_amount',
    'sgst_amount',
    'igst_amount',
    'total_amount',
    'payment_status',
    'input_mode',
    'sync_status',
    'created_at',
  ],
  invoice_items: [
    'id',
    'invoice_id',
    'product_id',
    'quantity',
    'unit_price',
    'hsn_code',
    'gst_rate',
    'discount',
    'taxable_value',
    'cgst_amount',
    'sgst_amount',
    'igst_amount',
    'line_total',
  ],
  payments: ['id', 'invoice_id', 'amount', 'payment_mode', 'payment_date', 'created_at'],
  ledger_entries: [
    'id',
    'business_id',
    'customer_id',
    'invoice_id',
    'payment_id',
    'debit',
    'credit',
    'description',
    'entry_date',
  ],
  expenses: ['id', 'business_id', 'category', 'description', 'amount', 'expense_date', 'payment_mode', 'created_at'],
  suppliers: ['id', 'business_id', 'name', 'gstin', 'phone', 'address', 'created_at'],
  purchases: [
    'id',
    'business_id',
    'supplier_id',
    'bill_number',
    'purchase_date',
    'amount',
    'payment_status',
    'payment_mode',
    'created_at',
  ],
  voice_transaction_logs: [
    'id',
    'business_id',
    'invoice_id',
    'raw_transcript',
    'parsed_json',
    'language',
    'input_mode',
    'created_at',
  ],
  gstr1_exports: [
    'id',
    'business_id',
    'period_from',
    'period_to',
    'total_invoices',
    'total_b2b',
    'total_b2c',
    'json_file_path',
    'status',
    'generated_at',
  ],
};

const TABLE_FOR: Record<string, string> = Object.fromEntries(ENTITY_PRIORITY.map((t) => [t, t]));

export function toSyncPayload(
  entityType: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const fields = SYNC_FIELDS[entityType];
  if (!fields) return data;
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in data) out[key] = data[key];
  }
  return out;
}

export class SyncManager {
  private outbox: OutboxRepository;
  private running = false;

  constructor(
    private db: SQLiteDatabase,
    private getBusinessId: () => string | null
  ) {
    this.outbox = new OutboxRepository(db);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pushAll();
      await this.pullAndApply();
    } catch (err) {
      console.warn('[sync] cycle failed', err);
    } finally {
      this.running = false;
    }
  }

  private async pushAll(): Promise<void> {
    // Drain the outbox in batches until empty or a hard failure.
    for (let i = 0; i < 20; i++) {
      const batch = await this.outbox.getPendingBatch(50);
      if (batch.length === 0) return;

      const sorted = [...batch].sort((a, b) => {
        const pa = ENTITY_PRIORITY.indexOf(a.entity_type);
        const pb = ENTITY_PRIORITY.indexOf(b.entity_type);
        return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb) || a.id - b.id;
      });

      const ids = sorted.map((item) => item.id);
      await this.outbox.markProcessing(ids);

      try {
        const items = sorted.map((item) => ({
          outbox_id: item.id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          operation: item.operation,
          data: toSyncPayload(item.entity_type, JSON.parse(item.payload) as Record<string, unknown>),
        }));
        const result = await apiClient.pushSync(items);
        if (result.processed_ids?.length) await this.outbox.markProcessed(result.processed_ids);
        if (result.failed_ids?.length) {
          await this.outbox.markBatchFailed(result.failed_ids, 'Server rejected item');
        }
        // Anything still PROCESSING after the response is a client/server id mismatch — fail them.
        const acknowledged = new Set([
          ...(result.processed_ids ?? []),
          ...(result.failed_ids ?? []),
        ]);
        const leftover = ids.filter((id) => !acknowledged.has(id));
        if (leftover.length) await this.outbox.markBatchFailed(leftover, 'Not acknowledged by server');
      } catch (err) {
        await this.outbox.markBatchFailed(ids, err instanceof Error ? err.message : String(err));
        return;
      }
    }
  }

  private async pullAndApply(): Promise<void> {
    const businessId = this.getBusinessId();
    if (!businessId) return;
    const since = await this.lastPullCursor();
    const result = await apiClient.pullSync(businessId, since ?? undefined);
    const pending = await this.outbox.pendingEntityIds();

    for (const entityType of ENTITY_PRIORITY) {
      const rows = result.changes?.[entityType] ?? [];
      for (const row of rows) {
        const id = String(row.id ?? '');
        if (!id || pending.has(id)) continue;
        await this.upsertRow(entityType, row);
      }
    }
    if (result.server_time) await this.savePullCursor(result.server_time);
  }

  private async upsertRow(entityType: string, row: Record<string, unknown>): Promise<void> {
    const table = TABLE_FOR[entityType];
    if (!table) return;
    const fields = SYNC_FIELDS[entityType];
    if (!fields) return;
    const cols = fields.filter((c) => c in row);
    if (cols.length === 0) return;
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(id) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP`;
    const values = cols.map((c) => (row[c] === undefined ? null : (row[c] as string | number | null)));
    await this.db.runAsync(sql, values);
  }

  private async lastPullCursor(): Promise<string | null> {
    // Reuse gstr1_exports is wrong; keep a tiny kv via a pragma-less table if present,
    // otherwise no cursor (full pull). We persist in a one-row meta table.
    await this.db.execAsync(
      `CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`
    );
    const row = await this.db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = 'last_pull'`
    );
    return row?.value ?? null;
  }

  private async savePullCursor(value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_meta (key, value) VALUES ('last_pull', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [value]
    );
  }
}

export function startSyncLoop(
  db: SQLiteDatabase,
  getBusinessId: () => string | null,
  onPendingChange?: (count: number) => void
): () => void {
  const manager = new SyncManager(db, getBusinessId);
  const tick = async () => {
    await manager.runOnce();
    if (onPendingChange) {
      const count = await new OutboxRepository(db).countPending();
      onPendingChange(count);
    }
  };
  void tick();
  const handle = setInterval(() => void tick(), CONFIG.SYNC_POLL_INTERVAL_MS);
  return () => clearInterval(handle);
}

// Keep this imported so unused-param lint does not fire on OutboxItem in future hooks.
export type { OutboxItem };

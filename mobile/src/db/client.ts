/**
 * Member 1 — Core Infrastructure (Native)
 * mobile/src/db/client.ts
 *
 * Opens the SQLite database via expo-sqlite and initializes drizzle-orm on iOS/Android.
 * Creates all tables on first launch (DDL from schema.ts).
 */

import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const sqlite = SQLite.openDatabaseSync('compliance_one.db');

export const db = drizzle(sqlite, { schema });

/**
 * Runs one-time table creation on app startup.
 * Safe to call multiple times (CREATE TABLE IF NOT EXISTS).
 */
export async function initDatabase(): Promise<void> {
  await sqlite.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id),
      business_name TEXT NOT NULL,
      gstin TEXT UNIQUE,
      address TEXT,
      phone TEXT,
      state_code TEXT,
      financial_year_start TEXT,
      voice_language TEXT NOT NULL DEFAULT 'ta',
      offline_mode INTEGER NOT NULL DEFAULT 1,
      printer_settings TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      hsn_code TEXT NOT NULL,
      gst_rate REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'PCS',
      price REAL NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      gstin TEXT,
      customer_type TEXT NOT NULL DEFAULT 'B2C',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      customer_id TEXT REFERENCES customers(id),
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      invoice_type TEXT NOT NULL DEFAULT 'B2C',
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,
      cgst REAL NOT NULL DEFAULT 0,
      sgst REAL NOT NULL DEFAULT 0,
      igst REAL NOT NULL DEFAULT 0,
      total_tax REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      notes TEXT,
      voice_log_id TEXT,
      is_gstr1_filed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      product_id TEXT REFERENCES products(id),
      product_name TEXT NOT NULL,
      hsn_code TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'PCS',
      rate REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL,
      gst_rate REAL NOT NULL,
      cgst REAL NOT NULL DEFAULT 0,
      sgst REAL NOT NULL DEFAULT 0,
      igst REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      customer_id TEXT REFERENCES customers(id),
      invoice_id TEXT REFERENCES invoices(id),
      payment_id TEXT REFERENCES payments(id),
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS gstr1_exports (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      period_from TEXT NOT NULL,
      period_to TEXT NOT NULL,
      total_invoices INTEGER NOT NULL DEFAULT 0,
      total_b2b INTEGER NOT NULL DEFAULT 0,
      total_b2c INTEGER NOT NULL DEFAULT 0,
      json_payload TEXT,
      exported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS voice_transaction_logs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      invoice_id TEXT REFERENCES invoices(id),
      raw_transcript TEXT NOT NULL,
      parsed_output TEXT,
      confidence_score REAL,
      stt_method TEXT NOT NULL DEFAULT 'on-device',
      language_code TEXT NOT NULL DEFAULT 'ta-IN',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      phone TEXT,
      gstin TEXT,
      address TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      supplier_id TEXT REFERENCES suppliers(id),
      invoice_ref TEXT,
      purchase_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      is_paid INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_invoices_business_date
      ON invoices(business_id, invoice_date);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
      ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice
      ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_customer
      ON ledger_entries(customer_id, entry_date);
    CREATE INDEX IF NOT EXISTS idx_outbox_unsynced
      ON sync_outbox(synced_at) WHERE synced_at IS NULL;

    -- Seed Default Business & User
    INSERT OR IGNORE INTO users (id, name, phone, email, password_hash)
    VALUES ('1', 'Demo User', '9999999999', 'demo@example.com', 'mock-hash');

    INSERT OR IGNORE INTO businesses (id, owner_user_id, business_name, gstin, address, phone, state_code, financial_year_start, voice_language, offline_mode)
    VALUES ('demo-biz', '1', 'Compliance Store', '33ABCDE1234F1Z5', 'Chennai, Tamil Nadu', '9840123456', '33', '2024-04-01', 'ta', 1);

    -- Seed Default Products
    INSERT OR IGNORE INTO products (id, business_id, name, hsn_code, gst_rate, unit, price, stock_quantity, is_active)
    VALUES
    ('p1', 'demo-biz', 'Basmati Rice 1kg (அரிசி)', '1006', 5, 'KG', 120, 50, 1),
    ('p2', 'demo-biz', 'Sugar 1kg (சர்க்கரை)', '1701', 5, 'KG', 45, 100, 1),
    ('p3', 'demo-biz', 'Sunflower Oil 1L (எண்ணெய்)', '1512', 5, 'LTR', 140, 40, 1),
    ('p4', 'demo-biz', 'Toor Dal 1kg (துவரம் பருப்பு)', '0713', 0, 'KG', 160, 30, 1),
    ('p5', 'demo-biz', 'Aavin Milk 500ml (பால்)', '0401', 0, 'PKT', 25, 60, 1),
    ('p6', 'demo-biz', 'Tea Powder 250g (தேயிலை)', '0902', 5, 'PKT', 95, 45, 1);

    -- Seed Default Customers
    INSERT OR IGNORE INTO customers (id, business_id, name, phone, address, customer_type)
    VALUES
    ('c1', 'demo-biz', 'Senthil Kumar (செந்தில்)', '9840123456', 'Chennai', 'B2C'),
    ('c2', 'demo-biz', 'Murugan Traders', '9840987654', 'Madurai', 'B2B');

    -- Seed Default Invoices
    INSERT OR IGNORE INTO invoices (id, business_id, customer_id, invoice_number, invoice_date, invoice_type, subtotal, discount, taxable_amount, cgst, sgst, igst, total_tax, grand_total, payment_status, notes)
    VALUES
    ('inv-101', 'demo-biz', 'c1', 'INV-0001', datetime('now', '-2 days'), 'B2C', 305, 0, 305, 7.25, 7.25, 0, 14.5, 319.5, 'paid', 'Voice billed'),
    ('inv-102', 'demo-biz', 'c2', 'INV-0002', datetime('now', '-1 days'), 'B2B', 1250, 50, 1200, 30, 30, 0, 60, 1260, 'unpaid', 'Store delivery'),
    ('inv-103', 'demo-biz', 'c1', 'INV-0003', datetime('now'), 'B2C', 580, 0, 580, 14.5, 14.5, 0, 29, 609, 'paid', 'Cash counter');

    INSERT OR IGNORE INTO invoice_items (id, invoice_id, product_id, product_name, hsn_code, quantity, unit, rate, discount, taxable_amount, gst_rate, cgst, sgst, igst, total)
    VALUES
    ('ii-1', 'inv-101', 'p1', 'Basmati Rice 1kg (அரிசி)', '1006', 2, 'KG', 120, 0, 240, 5, 6, 6, 0, 252),
    ('ii-2', 'inv-101', 'p2', 'Sugar 1kg (சர்க்கரை)', '1701', 1, 'KG', 45, 0, 45, 5, 1.25, 1.25, 0, 47.5);
  `);
}

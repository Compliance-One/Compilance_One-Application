import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = await SQLite.openDatabaseAsync('compliance_one.db');
  await initSchema(dbInstance);
  return dbInstance;
};

export const initSchema = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY NOT NULL,
      owner_user_id TEXT,
      business_name TEXT NOT NULL,
      gstin TEXT,
      address TEXT,
      phone TEXT,
      financial_year_start TEXT,
      voice_language TEXT DEFAULT 'ta-IN',
      offline_mode INTEGER DEFAULT 1,
      printer_settings TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hsn_code TEXT,
      gst_rate REAL DEFAULT 0.0,
      unit TEXT DEFAULT 'nos',
      price REAL NOT NULL,
      stock_quantity REAL DEFAULT 0.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      gstin TEXT,
      customer_type TEXT CHECK(customer_type IN ('B2B', 'B2C')) DEFAULT 'B2C',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      invoice_type TEXT CHECK(invoice_type IN ('B2B', 'B2C')) DEFAULT 'B2C',
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      taxable_amount REAL NOT NULL,
      cgst_amount REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      total_amount REAL NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('PAID', 'UNPAID', 'PARTIAL')) DEFAULT 'UNPAID',
      input_mode TEXT CHECK(input_mode IN ('voice', 'text')) DEFAULT 'voice',
      sync_status TEXT CHECK(sync_status IN ('pending', 'synced', 'failed')) DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      hsn_code TEXT,
      gst_rate REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      taxable_value REAL NOT NULL,
      cgst_amount REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      line_total REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'CASH',
      payment_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      invoice_id TEXT,
      payment_id TEXT,
      debit REAL DEFAULT 0.0,
      credit REAL DEFAULT 0.0,
      description TEXT,
      entry_date TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('PENDING', 'PROCESSING', 'FAILED')) DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0
    );

    CREATE VIEW IF NOT EXISTS v_customer_balances AS
    SELECT 
      business_id, 
      customer_id, 
      (SUM(credit) - SUM(debit)) AS balance
    FROM ledger_entries
    GROUP BY business_id, customer_id;
  `);
};

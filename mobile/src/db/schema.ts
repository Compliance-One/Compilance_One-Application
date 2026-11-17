import * as SQLite from 'expo-sqlite';

const SCHEMA_VERSION = 1;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('compliance_one.db');
  await migrate(dbInstance);
  return dbInstance;
};

/** Exposed for tests / reset. */
export function resetDbInstance(): void {
  dbInstance = null;
}

async function tableExists(db: SQLite.SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name]
  );
  return !!row;
}

async function columnNames(db: SQLite.SQLiteDatabase, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => r.name));
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  if (!(await tableExists(db, table))) return;
  const cols = await columnNames(db, table);
  if (!cols.has(column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const CREATE_TABLES_SQL = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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
      state_code TEXT DEFAULT '33',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      sku TEXT,
      category TEXT,
      purchase_price REAL DEFAULT 0,
      min_stock_level REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
      state_code TEXT,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      customer_id TEXT,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      invoice_type TEXT CHECK(invoice_type IN ('B2B', 'B2C')) DEFAULT 'B2C',
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      taxable_amount REAL NOT NULL,
      cgst_amount REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      total_amount REAL NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('PAID', 'UNPAID', 'PARTIAL', 'CANCELLED')) DEFAULT 'UNPAID',
      input_mode TEXT CHECK(input_mode IN ('voice', 'text')) DEFAULT 'text',
      sync_status TEXT CHECK(sync_status IN ('pending', 'synced', 'failed')) DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      UNIQUE(business_id, invoice_number)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      product_id TEXT,
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      gstin TEXT,
      phone TEXT,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      bill_number TEXT,
      purchase_date TEXT,
      amount REAL NOT NULL,
      payment_status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS voice_transaction_logs (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      invoice_id TEXT,
      raw_transcript TEXT,
      parsed_json TEXT,
      language TEXT,
      input_mode TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS gstr1_exports (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      period_from TEXT,
      period_to TEXT,
      total_invoices INTEGER,
      total_b2b INTEGER,
      total_b2c INTEGER,
      json_file_path TEXT,
      status TEXT,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
      payload TEXT NOT NULL,
      status TEXT CHECK(status IN ('PENDING', 'PROCESSING', 'FAILED', 'COMPLETED')) DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`;

const CUSTOMER_BALANCES_VIEW = `
    DROP VIEW IF EXISTS v_customer_balances;
    CREATE VIEW v_customer_balances AS
    SELECT
       business_id,
       customer_id,
       (SUM(credit) - SUM(debit)) AS balance
    FROM ledger_entries
    GROUP BY business_id, customer_id;
`;

async function rebuildInvoicesIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  if (!(await tableExists(db, 'invoices'))) return;
  // Recreate to pick up the expanded payment_status CHECK and nullable customer_id / due_date.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS invoices_v1 (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      customer_id TEXT,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      invoice_type TEXT CHECK(invoice_type IN ('B2B', 'B2C')) DEFAULT 'B2C',
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0.0,
      taxable_amount REAL NOT NULL,
      cgst_amount REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      total_amount REAL NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('PAID', 'UNPAID', 'PARTIAL', 'CANCELLED')) DEFAULT 'UNPAID',
      input_mode TEXT CHECK(input_mode IN ('voice', 'text')) DEFAULT 'text',
      sync_status TEXT CHECK(sync_status IN ('pending', 'synced', 'failed')) DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      UNIQUE(business_id, invoice_number)
    );
  `);

  const cols = await columnNames(db, 'invoices');
  const dueSel = cols.has('due_date') ? 'due_date' : 'NULL';
  const updatedSel = cols.has('updated_at') ? 'updated_at' : 'created_at';

  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    INSERT OR IGNORE INTO invoices_v1 (
      id, business_id, customer_id, invoice_number, invoice_date, due_date,
      invoice_type, subtotal, discount, taxable_amount, cgst_amount, sgst_amount,
      igst_amount, total_amount, payment_status, input_mode, sync_status, created_at, updated_at
    )
    SELECT
      id, business_id, customer_id, invoice_number, invoice_date, ${dueSel},
      invoice_type, subtotal, discount, taxable_amount, cgst_amount, sgst_amount,
      igst_amount, total_amount,
      CASE UPPER(COALESCE(payment_status, 'UNPAID'))
        WHEN 'PAID' THEN 'PAID'
        WHEN 'PARTIAL' THEN 'PARTIAL'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'PENDING' THEN 'UNPAID'
        WHEN 'OVERDUE' THEN 'UNPAID'
        WHEN 'UNPAID' THEN 'UNPAID'
        ELSE 'UNPAID'
      END,
      input_mode, sync_status, created_at, ${updatedSel}
    FROM invoices;
    DROP TABLE invoices;
    ALTER TABLE invoices_v1 RENAME TO invoices;
    PRAGMA foreign_keys = ON;
  `);
}

export const migrate = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  await db.execAsync(CREATE_TABLES_SQL);

  if (current < 1) {
    await addColumnIfMissing(db, 'users', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'businesses', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'businesses', 'state_code', "TEXT DEFAULT '33'");
    await addColumnIfMissing(db, 'products', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'products', 'sku', 'TEXT');
    await addColumnIfMissing(db, 'products', 'category', 'TEXT');
    await addColumnIfMissing(db, 'products', 'purchase_price', 'REAL DEFAULT 0');
    await addColumnIfMissing(db, 'products', 'min_stock_level', 'REAL DEFAULT 0');
    await addColumnIfMissing(db, 'customers', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'customers', 'state_code', 'TEXT');
    await addColumnIfMissing(db, 'customers', 'email', 'TEXT');
    await addColumnIfMissing(db, 'payments', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'ledger_entries', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'ledger_entries', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'expenses', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'suppliers', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'purchases', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'voice_transaction_logs', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'gstr1_exports', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'gstr1_exports', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'invoice_items', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(db, 'invoice_items', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

    if (await tableExists(db, 'invoices')) {
      await rebuildInvoicesIfNeeded(db);
    }

    await db.execAsync(CUSTOMER_BALANCES_VIEW);
    await db.execAsync('PRAGMA user_version = 1');
  }

  // Always ensure the view exists (fresh installs go through CREATE TABLE IF NOT EXISTS
  // but the view is dropped/recreated only in the version bump above).
  if (current >= SCHEMA_VERSION) {
    const view = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'view' AND name = 'v_customer_balances'`
    );
    if (!view) await db.execAsync(CUSTOMER_BALANCES_VIEW);
  }
};

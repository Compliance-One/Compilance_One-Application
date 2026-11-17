import type { SQLiteDatabase } from 'expo-sqlite';
import { CONFIG } from '../config/env';
import { addDays, localISODate } from '../lib/dates';
import { newId } from '../lib/id';
import { calculateInvoiceTotals, normalizeStateCode, stateNameFor, type GstLineInput } from '../lib/gst';
import { OutboxRepository } from '../sync/outbox';
import { toSyncPayload } from '../sync/syncManager';
import type { InvoiceDocument } from '../billing/invoiceDocument';
import { HARDWARE_CATALOG } from '../data/hardwareCatalog';

export interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  category: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
  taxRate: number;
  currentStock: number;
  minStockLevel: number;
}

export interface CustomerRecord {
  id: string;
  name: string;
  tradeName?: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  stateCode: string;
  stateName: string;
  billingAddress: string;
  outstandingBalance: number;
  creditLimit: number;
}

export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerGstin?: string;
  date: string;
  dueDate?: string;
  totalAmount: number;
  balanceDue: number;
  paymentStatus: string;
  itemsCount: number;
}

export interface InvoiceLineInput {
  id?: string;
  name: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  taxRate: number;
  productId?: string;
}

export interface CreateInvoiceInput {
  businessId: string;
  sellerStateCode: string;
  buyerStateCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  paymentTermsDays?: number;
  inputMode: 'voice' | 'text';
  /** null/undefined or an empty name = walk-in sale (no customer record, no ledger entry). */
  customer?: {
    id?: string;
    name: string;
    gstin?: string;
    phone?: string;
    email?: string;
    stateCode?: string;
    address?: string;
  } | null;
  items: InvoiceLineInput[];
}

function rowToProduct(r: Record<string, unknown>): ProductRecord {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    sku: String(r.sku ?? ''),
    hsnCode: String(r.hsn_code ?? ''),
    category: String(r.category ?? ''),
    unit: String(r.unit ?? 'PCS'),
    sellingPrice: Number(r.price ?? 0),
    purchasePrice: Number(r.purchase_price ?? 0),
    taxRate: Number(r.gst_rate ?? 0),
    currentStock: Number(r.stock_quantity ?? 0),
    minStockLevel: Number(r.min_stock_level ?? 0),
  };
}

export async function listProducts(db: SQLiteDatabase, businessId: string): Promise<ProductRecord[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM products WHERE business_id = ? ORDER BY name COLLATE NOCASE`,
    [businessId]
  );
  return rows.map(rowToProduct);
}

export async function upsertProduct(
  db: SQLiteDatabase,
  businessId: string,
  product: ProductRecord,
  isNew: boolean
): Promise<void> {
  const outbox = new OutboxRepository(db);
  const payload = {
    id: product.id,
    business_id: businessId,
    name: product.name,
    hsn_code: product.hsnCode || null,
    gst_rate: product.taxRate,
    unit: product.unit || 'PCS',
    price: product.sellingPrice,
    stock_quantity: product.currentStock,
    sku: product.sku || null,
    category: product.category || null,
    purchase_price: product.purchasePrice,
    min_stock_level: product.minStockLevel,
    created_at: localISODate(),
  };
  await db.withTransactionAsync(async () => {
    if (isNew) {
      await db.runAsync(
        `INSERT INTO products (
           id, business_id, name, hsn_code, gst_rate, unit, price, stock_quantity,
           sku, category, purchase_price, min_stock_level, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          product.id,
          businessId,
          product.name,
          product.hsnCode || null,
          product.taxRate,
          product.unit || 'PCS',
          product.sellingPrice,
          product.currentStock,
          product.sku || null,
          product.category || null,
          product.purchasePrice,
          product.minStockLevel,
        ]
      );
      await outbox.enqueue('products', product.id, 'INSERT', toSyncPayload('products', payload));
    } else {
      await db.runAsync(
        `UPDATE products SET
           name = ?, hsn_code = ?, gst_rate = ?, unit = ?, price = ?, stock_quantity = ?,
           sku = ?, category = ?, purchase_price = ?, min_stock_level = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND business_id = ?`,
        [
          product.name,
          product.hsnCode || null,
          product.taxRate,
          product.unit || 'PCS',
          product.sellingPrice,
          product.currentStock,
          product.sku || null,
          product.category || null,
          product.purchasePrice,
          product.minStockLevel,
          product.id,
          businessId,
        ]
      );
      await outbox.enqueue('products', product.id, 'UPDATE', toSyncPayload('products', payload));
    }
  });
}

export async function deleteProduct(db: SQLiteDatabase, businessId: string, productId: string): Promise<void> {
  const outbox = new OutboxRepository(db);
  const existing = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM products WHERE id = ? AND business_id = ?`,
    [productId, businessId]
  );
  if (!existing) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM products WHERE id = ? AND business_id = ?`, [productId, businessId]);
    await outbox.enqueue('products', productId, 'DELETE', toSyncPayload('products', { id: productId, ...existing }));
  });
}

export async function adjustProductStock(
  db: SQLiteDatabase,
  businessId: string,
  productId: string,
  newStock: number
): Promise<void> {
  const outbox = new OutboxRepository(db);
  const existing = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM products WHERE id = ? AND business_id = ?`,
    [productId, businessId]
  );
  if (!existing) throw new Error('Product not found');
  const payload = { ...existing, stock_quantity: newStock };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStock, productId]
    );
    await outbox.enqueue('products', productId, 'UPDATE', toSyncPayload('products', payload));
  });
}

export async function listCustomers(db: SQLiteDatabase, businessId: string): Promise<CustomerRecord[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT c.*, COALESCE(b.balance, 0) AS outstanding
     FROM customers c
     LEFT JOIN v_customer_balances b
       ON b.business_id = c.business_id AND b.customer_id = c.id
     WHERE c.business_id = ?
     ORDER BY c.name COLLATE NOCASE`,
    [businessId]
  );
  return rows.map((r) => {
    const stateCode = normalizeStateCode(String(r.state_code ?? '')) || CONFIG.DEFAULT_STATE_CODE;
    return {
      id: String(r.id),
      name: String(r.name ?? ''),
      tradeName: '',
      gstin: String(r.gstin ?? ''),
      pan: '',
      phone: String(r.phone ?? ''),
      email: String(r.email ?? ''),
      stateCode,
      stateName: stateNameFor(stateCode),
      billingAddress: String(r.address ?? ''),
      // ledger view is credit - debit; a customer who owes us has a negative? 
      // Audit: OWED_IS_NEGATIVE unsettled. Mobile ledger uses owed as negative of balance
      // when credit-debit is the stored balance. If they owe us, debit > credit, balance < 0.
      // outstandingBalance for the UI is "what they owe us" = max(0, -balance) or abs if negative.
      outstandingBalance: Math.max(0, -Number(r.outstanding ?? 0)),
      creditLimit: 0,
    };
  });
}

export async function upsertCustomer(
  db: SQLiteDatabase,
  businessId: string,
  customer: CustomerRecord,
  isNew: boolean
): Promise<void> {
  const outbox = new OutboxRepository(db);
  const type = customer.gstin ? 'B2B' : 'B2C';
  const payload = {
    id: customer.id,
    business_id: businessId,
    name: customer.name,
    phone: customer.phone || null,
    address: customer.billingAddress || null,
    gstin: customer.gstin || null,
    customer_type: type,
    created_at: localISODate(),
  };
  await db.withTransactionAsync(async () => {
    if (isNew) {
      await db.runAsync(
        `INSERT INTO customers (
           id, business_id, name, phone, address, gstin, customer_type, state_code, email, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          customer.id,
          businessId,
          customer.name,
          customer.phone || null,
          customer.billingAddress || null,
          customer.gstin || null,
          type,
          normalizeStateCode(customer.stateCode) || null,
          customer.email || null,
        ]
      );
      await outbox.enqueue('customers', customer.id, 'INSERT', toSyncPayload('customers', payload));
    } else {
      await db.runAsync(
        `UPDATE customers SET
           name = ?, phone = ?, address = ?, gstin = ?, customer_type = ?, state_code = ?, email = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND business_id = ?`,
        [
          customer.name,
          customer.phone || null,
          customer.billingAddress || null,
          customer.gstin || null,
          type,
          normalizeStateCode(customer.stateCode) || null,
          customer.email || null,
          customer.id,
          businessId,
        ]
      );
      await outbox.enqueue('customers', customer.id, 'UPDATE', toSyncPayload('customers', payload));
    }
  });
}

export async function listInvoices(db: SQLiteDatabase, businessId: string): Promise<InvoiceListRow[]> {
  const rows = await db.getAllAsync<{
    id: string;
    invoice_number: string;
    customer_name: string | null;
    customer_gstin: string | null;
    invoice_date: string;
    due_date: string | null;
    total_amount: number;
    payment_status: string;
    items_count: number;
    paid: number;
  }>(
    `SELECT i.id, i.invoice_number, c.name AS customer_name, c.gstin AS customer_gstin,
            i.invoice_date, i.due_date, i.total_amount, i.payment_status,
            (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS items_count,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.business_id = ?
     ORDER BY i.invoice_date DESC, i.created_at DESC`,
    [businessId]
  );
  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    customerName: r.customer_name ?? 'Walk-in',
    customerGstin: r.customer_gstin ?? undefined,
    date: r.invoice_date,
    dueDate: r.due_date ?? undefined,
    totalAmount: r.total_amount,
    balanceDue: Math.max(0, Number(r.total_amount) - Number(r.paid ?? 0)),
    paymentStatus: r.payment_status,
    itemsCount: Number(r.items_count ?? 0),
  }));
}

export async function nextInvoiceNumber(db: SQLiteDatabase, businessId: string): Promise<string> {
  const year = new Date().getFullYear() % 100;
  const prefix = `CO-${String(year).padStart(2, '0')}/`;
  const row = await db.getFirstAsync<{ invoice_number: string }>(
    `SELECT invoice_number FROM invoices
     WHERE business_id = ? AND invoice_number LIKE ?
     ORDER BY invoice_number DESC LIMIT 1`,
    [businessId, `${prefix}%`]
  );
  let seq = 1;
  if (row?.invoice_number) {
    const n = parseInt(row.invoice_number.slice(prefix.length), 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function findOrCreateCustomer(
  db: SQLiteDatabase,
  outbox: OutboxRepository,
  businessId: string,
  customer: NonNullable<CreateInvoiceInput['customer']>
): Promise<string> {
  if (customer.id) {
    const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM customers WHERE id = ?`, [customer.id]);
    if (existing) return existing.id;
  }
  if (customer.gstin) {
    const byGstin = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM customers WHERE business_id = ? AND gstin = ?`,
      [businessId, customer.gstin]
    );
    if (byGstin) return byGstin.id;
  }
  if (customer.phone) {
    const byPhone = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM customers WHERE business_id = ? AND phone = ? AND name = ?`,
      [businessId, customer.phone, customer.name]
    );
    if (byPhone) return byPhone.id;
  }
  const byName = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM customers WHERE business_id = ? AND name = ? AND IFNULL(gstin,'') = IFNULL(?, '')`,
    [businessId, customer.name, customer.gstin ?? '']
  );
  if (byName) return byName.id;

  const id = newId();
  const type = customer.gstin ? 'B2B' : 'B2C';
  const payload = {
    id,
    business_id: businessId,
    name: customer.name,
    phone: customer.phone || null,
    address: customer.address || null,
    gstin: customer.gstin || null,
    customer_type: type,
    created_at: localISODate(),
  };
  await db.runAsync(
    `INSERT INTO customers (
       id, business_id, name, phone, address, gstin, customer_type, state_code, email, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      businessId,
      customer.name,
      customer.phone || null,
      customer.address || null,
      customer.gstin || null,
      type,
      normalizeStateCode(customer.stateCode) || null,
      customer.email || null,
    ]
  );
  await outbox.enqueue('customers', id, 'INSERT', toSyncPayload('customers', payload));
  return id;
}

async function findOrCreateProduct(
  db: SQLiteDatabase,
  outbox: OutboxRepository,
  businessId: string,
  item: InvoiceLineInput
): Promise<string> {
  if (item.productId) {
    const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM products WHERE id = ?`, [item.productId]);
    if (existing) return existing.id;
  }
  const byName = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM products WHERE business_id = ? AND name = ?`,
    [businessId, item.name]
  );
  if (byName) return byName.id;
  const id = newId();
  const payload = {
    id,
    business_id: businessId,
    name: item.name,
    hsn_code: item.hsnCode || null,
    gst_rate: item.taxRate,
    unit: item.unit || 'PCS',
    price: item.unitPrice,
    stock_quantity: 0,
    created_at: localISODate(),
  };
  await db.runAsync(
    `INSERT INTO products (
       id, business_id, name, hsn_code, gst_rate, unit, price, stock_quantity, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, businessId, item.name, item.hsnCode || null, item.taxRate, item.unit || 'PCS', item.unitPrice]
  );
  await outbox.enqueue('products', id, 'INSERT', toSyncPayload('products', payload));
  return id;
}

export async function createInvoice(db: SQLiteDatabase, input: CreateInvoiceInput): Promise<string> {
  const outbox = new OutboxRepository(db);
  const gstInputs: GstLineInput[] = input.items.map((it) => ({
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    taxRate: it.taxRate,
    discountPercent: it.discountPercent ?? 0,
  }));
  const { lines, summary } = calculateInvoiceTotals(gstInputs, input.sellerStateCode, input.buyerStateCode);
  const buyer = input.customer && input.customer.name?.trim() ? input.customer : null;
  const invoiceType = buyer?.gstin ? 'B2B' : 'B2C';
  const dueDate =
    input.dueDate ?? (input.paymentTermsDays ? addDays(input.invoiceDate, input.paymentTermsDays) : addDays(input.invoiceDate, 15));
  const invoiceId = newId();

  await db.withTransactionAsync(async () => {
    const customerId = buyer ? await findOrCreateCustomer(db, outbox, input.businessId, buyer) : null;

    const invoicePayload = {
      id: invoiceId,
      business_id: input.businessId,
      customer_id: customerId,
      invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate,
      invoice_type: invoiceType,
      subtotal: summary.totalTaxableAmount + summary.totalTaxAmount,
      discount: lines.reduce((s, l) => s + l.discountAmount, 0),
      taxable_amount: summary.totalTaxableAmount,
      cgst_amount: summary.totalCgstAmount,
      sgst_amount: summary.totalSgstAmount,
      igst_amount: summary.totalIgstAmount,
      total_amount: summary.grandTotal,
      payment_status: 'UNPAID',
      input_mode: input.inputMode,
      sync_status: 'pending',
      created_at: localISODate(),
    };

    await db.runAsync(
      `INSERT INTO invoices (
         id, business_id, customer_id, invoice_number, invoice_date, due_date, invoice_type,
         subtotal, discount, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount,
         payment_status, input_mode, sync_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        invoiceId,
        input.businessId,
        customerId,
        input.invoiceNumber,
        input.invoiceDate,
        dueDate,
        invoiceType,
        invoicePayload.subtotal,
        invoicePayload.discount,
        summary.totalTaxableAmount,
        summary.totalCgstAmount,
        summary.totalSgstAmount,
        summary.totalIgstAmount,
        summary.grandTotal,
        input.inputMode,
      ]
    );
    await outbox.enqueue('invoices', invoiceId, 'INSERT', toSyncPayload('invoices', invoicePayload));

    for (let i = 0; i < input.items.length; i++) {
      const src = input.items[i];
      const line = lines[i];
      const productId = await findOrCreateProduct(db, outbox, input.businessId, src);
      const itemId = src.id && src.id.length > 8 ? src.id : newId();
      const itemPayload = {
        id: itemId,
        invoice_id: invoiceId,
        product_id: productId,
        quantity: src.quantity,
        unit_price: src.unitPrice,
        hsn_code: src.hsnCode || null,
        gst_rate: src.taxRate,
        discount: line.discountAmount,
        taxable_value: line.taxableAmount,
        cgst_amount: line.cgstAmount,
        sgst_amount: line.sgstAmount,
        igst_amount: line.igstAmount,
        line_total: line.totalAmount,
      };
      await db.runAsync(
        `INSERT INTO invoice_items (
           id, invoice_id, product_id, quantity, unit_price, hsn_code, gst_rate, discount,
           taxable_value, cgst_amount, sgst_amount, igst_amount, line_total, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          itemId,
          invoiceId,
          productId,
          src.quantity,
          src.unitPrice,
          src.hsnCode || null,
          src.taxRate,
          line.discountAmount,
          line.taxableAmount,
          line.cgstAmount,
          line.sgstAmount,
          line.igstAmount,
          line.totalAmount,
        ]
      );
      await outbox.enqueue('invoice_items', itemId, 'INSERT', toSyncPayload('invoice_items', itemPayload));
      await db.runAsync(
        `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [src.quantity, productId]
      );
      const prod = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM products WHERE id = ?`, [productId]);
      if (prod) {
        await outbox.enqueue('products', productId, 'UPDATE', toSyncPayload('products', prod));
      }
    }

    // Walk-in sales have no customer account, so nothing goes on the ledger.
    if (!customerId) return;
    const ledgerId = newId();
    const ledgerPayload = {
      id: ledgerId,
      business_id: input.businessId,
      customer_id: customerId,
      invoice_id: invoiceId,
      payment_id: null,
      debit: summary.grandTotal,
      credit: 0,
      description: `Invoice ${input.invoiceNumber}`,
      entry_date: input.invoiceDate,
    };
    await db.runAsync(
      `INSERT INTO ledger_entries (
         id, business_id, customer_id, invoice_id, debit, credit, description, entry_date, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [ledgerId, input.businessId, customerId, invoiceId, summary.grandTotal, ledgerPayload.description, input.invoiceDate]
    );
    await outbox.enqueue('ledger_entries', ledgerId, 'INSERT', toSyncPayload('ledger_entries', ledgerPayload));
  });

  return invoiceId;
}

export interface BusinessRecord {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string;
  address: string | null;
  phone: string | null;
  voiceLanguage: string | null;
  ownerUserId: string | null;
  openingCash: number;
  openingBank: number;
}

export async function getFirstBusiness(db: SQLiteDatabase): Promise<BusinessRecord | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM businesses ORDER BY created_at LIMIT 1`
  );
  if (!row) return null;
  return mapBusiness(row);
}

function mapBusiness(row: Record<string, unknown>): BusinessRecord {
  return {
    id: String(row.id),
    name: String(row.business_name ?? 'My Business'),
    gstin: (row.gstin as string | null) ?? null,
    stateCode: normalizeStateCode(String(row.state_code ?? '')) || CONFIG.DEFAULT_STATE_CODE,
    address: (row.address as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    voiceLanguage: (row.voice_language as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    openingCash: Number(row.opening_cash_balance ?? 0) || 0,
    openingBank: Number(row.opening_bank_balance ?? 0) || 0,
  };
}

function businessSyncPayload(row: Record<string, unknown>, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: row.id,
    owner_user_id: extras.owner_user_id ?? row.owner_user_id ?? null,
    business_name: extras.business_name ?? row.business_name,
    gstin: extras.gstin ?? row.gstin ?? null,
    address: extras.address ?? row.address ?? null,
    phone: extras.phone ?? row.phone ?? null,
    financial_year_start: row.financial_year_start ?? null,
    voice_language: row.voice_language ?? null,
    offline_mode: row.offline_mode ?? 1,
    printer_settings: row.printer_settings ?? null,
    opening_cash_balance: extras.opening_cash_balance ?? row.opening_cash_balance ?? 0,
    opening_bank_balance: extras.opening_bank_balance ?? row.opening_bank_balance ?? 0,
    created_at: row.created_at ?? localISODate(),
  };
}

/** @deprecated Prefer ensureBusinessLinked after login so the row is enqueued. */
export async function seedDefaultBusiness(db: SQLiteDatabase): Promise<BusinessRecord> {
  const existing = await getFirstBusiness(db);
  if (existing) return existing;
  return ensureBusinessLinked(db, null);
}

/**
 * Create or claim the on-device business for this user and enqueue it for
 * sync. This closes the previous gap where a seeded business never left the device.
 */
export async function ensureBusinessLinked(
  db: SQLiteDatabase,
  ownerUserId: string | null
): Promise<BusinessRecord> {
  const outbox = new OutboxRepository(db);
  const existing = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM businesses ORDER BY created_at LIMIT 1`
  );
  if (existing) {
    const alreadyOwned = existing.owner_user_id && String(existing.owner_user_id) === ownerUserId;
    if (ownerUserId && !alreadyOwned) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE businesses SET owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [ownerUserId, String(existing.id)]
        );
        const payload = businessSyncPayload(existing, { owner_user_id: ownerUserId });
        const op: 'INSERT' | 'UPDATE' = existing.owner_user_id ? 'UPDATE' : 'INSERT';
        await outbox.enqueue('businesses', String(existing.id), op, toSyncPayload('businesses', payload));
      });
    }
    return (await getFirstBusiness(db))!;
  }
  const id = newId();
  const fy = `${new Date().getFullYear()}-04-01`;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO businesses (
         id, owner_user_id, business_name, state_code, voice_language, offline_mode,
         financial_year_start, opening_cash_balance, opening_bank_balance, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'ta-IN', 1, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, ownerUserId, 'My Business', CONFIG.DEFAULT_STATE_CODE, fy]
    );
    const payload = {
      id,
      owner_user_id: ownerUserId,
      business_name: 'My Business',
      gstin: null,
      address: null,
      phone: null,
      financial_year_start: fy,
      voice_language: 'ta-IN',
      offline_mode: 1,
      printer_settings: null,
      opening_cash_balance: 0,
      opening_bank_balance: 0,
      created_at: localISODate(),
    };
    await outbox.enqueue('businesses', id, 'INSERT', toSyncPayload('businesses', payload));
  });
  return (await getFirstBusiness(db))!;
}

export async function updateBusinessProfile(
  db: SQLiteDatabase,
  businessId: string,
  patch: { name?: string; gstin?: string | null; stateCode?: string; address?: string | null; phone?: string | null; openingCash?: number; openingBank?: number }
): Promise<void> {
  const outbox = new OutboxRepository(db);
  const current = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM businesses WHERE id = ?`, [businessId]);
  if (!current) return;
  const name = patch.name ?? String(current.business_name);
  const gstin = patch.gstin === undefined ? (current.gstin as string | null) : patch.gstin;
  const stateCode = patch.stateCode ?? String(current.state_code ?? CONFIG.DEFAULT_STATE_CODE);
  const address = patch.address === undefined ? (current.address as string | null) : patch.address;
  const phone = patch.phone === undefined ? (current.phone as string | null) : patch.phone;
  const openingCash = patch.openingCash === undefined ? Number(current.opening_cash_balance ?? 0) : patch.openingCash;
  const openingBank = patch.openingBank === undefined ? Number(current.opening_bank_balance ?? 0) : patch.openingBank;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE businesses SET business_name = ?, gstin = ?, state_code = ?, address = ?, phone = ?,
         opening_cash_balance = ?, opening_bank_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, gstin, normalizeStateCode(stateCode) || CONFIG.DEFAULT_STATE_CODE, address, phone, openingCash, openingBank, businessId]
    );
    const payload = businessSyncPayload(current, {
      business_name: name,
      gstin,
      address,
      phone,
      opening_cash_balance: openingCash,
      opening_bank_balance: openingBank,
    });
    await outbox.enqueue('businesses', businessId, 'UPDATE', toSyncPayload('businesses', payload));
  });
}

export async function recordGstr1Export(
  db: SQLiteDatabase,
  input: {
    businessId: string;
    periodFrom: string;
    periodTo: string;
    totalInvoices: number;
    totalB2b: number;
    totalB2c: number;
    jsonFilePath: string;
    status?: string;
  }
): Promise<string> {
  const outbox = new OutboxRepository(db);
  const id = newId();
  const payload = {
    id,
    business_id: input.businessId,
    period_from: input.periodFrom,
    period_to: input.periodTo,
    total_invoices: input.totalInvoices,
    total_b2b: input.totalB2b,
    total_b2c: input.totalB2c,
    json_file_path: input.jsonFilePath,
    status: input.status ?? 'generated',
    generated_at: new Date().toISOString(),
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO gstr1_exports (
         id, business_id, period_from, period_to, total_invoices, total_b2b, total_b2c,
         json_file_path, status, generated_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        input.businessId,
        input.periodFrom,
        input.periodTo,
        input.totalInvoices,
        input.totalB2b,
        input.totalB2c,
        input.jsonFilePath,
        payload.status,
        payload.generated_at,
      ]
    );
    await outbox.enqueue('gstr1_exports', id, 'INSERT', toSyncPayload('gstr1_exports', payload));
  });
  return id;
}

export async function getInvoiceDetail(db: SQLiteDatabase, invoiceId: string): Promise<InvoiceDocument | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT i.*,
            c.id AS c_id, c.name AS c_name, c.gstin AS c_gstin, c.phone AS c_phone,
            c.address AS c_address, c.state_code AS c_state,
            b.id AS b_id, b.business_name AS b_name, b.gstin AS b_gstin, b.phone AS b_phone,
            b.address AS b_address, b.state_code AS b_state
     FROM invoices i
     JOIN businesses b ON b.id = i.business_id
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.id = ?`,
    [invoiceId]
  );
  if (!row) return null;

  const items = await db.getAllAsync<Record<string, unknown>>(
    `SELECT ii.*, p.name AS product_name, p.unit AS product_unit
     FROM invoice_items ii
     LEFT JOIN products p ON p.id = ii.product_id
     WHERE ii.invoice_id = ?
     ORDER BY ii.created_at, ii.id`,
    [invoiceId]
  );

  const sellerState = normalizeStateCode(String(row.b_state ?? '')) || CONFIG.DEFAULT_STATE_CODE;
  const buyerState = normalizeStateCode(String(row.c_state ?? '')) || sellerState;

  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    invoiceDate: String(row.invoice_date),
    dueDate: (row.due_date as string | null) ?? null,
    invoiceType: (String(row.invoice_type) === 'B2B' ? 'B2B' : 'B2C'),
    placeOfSupplyCode: buyerState,
    placeOfSupplyName: stateNameFor(buyerState),
    reverseCharge: false,
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    taxableAmount: Number(row.taxable_amount ?? 0),
    cgstAmount: Number(row.cgst_amount ?? 0),
    sgstAmount: Number(row.sgst_amount ?? 0),
    igstAmount: Number(row.igst_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    paymentStatus: String(row.payment_status ?? 'UNPAID'),
    seller: {
      id: String(row.b_id),
      name: String(row.b_name ?? 'My Business'),
      gstin: (row.b_gstin as string | null) ?? null,
      address: (row.b_address as string | null) ?? null,
      phone: (row.b_phone as string | null) ?? null,
      stateCode: sellerState,
      stateName: stateNameFor(sellerState),
    },
    buyer: row.c_id
      ? {
          id: String(row.c_id),
          name: String(row.c_name ?? 'Walk-in'),
          gstin: (row.c_gstin as string | null) ?? null,
          address: (row.c_address as string | null) ?? null,
          phone: (row.c_phone as string | null) ?? null,
          stateCode: buyerState,
          stateName: stateNameFor(buyerState),
        }
      : null,
    items: items.map((it, idx) => ({
      id: String(it.id ?? idx),
      name: String(it.product_name ?? 'Item'),
      hsnCode: (it.hsn_code as string | null) ?? null,
      quantity: Number(it.quantity ?? 0),
      unit: String(it.product_unit ?? 'PCS'),
      unitPrice: Number(it.unit_price ?? 0),
      discount: Number(it.discount ?? 0),
      gstRate: Number(it.gst_rate ?? 0),
      taxableValue: Number(it.taxable_value ?? 0),
      cgstAmount: Number(it.cgst_amount ?? 0),
      sgstAmount: Number(it.sgst_amount ?? 0),
      igstAmount: Number(it.igst_amount ?? 0),
      lineTotal: Number(it.line_total ?? 0),
    })),
  };
}


/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export type SimplePaymentMode = 'CASH' | 'UPI' | 'BANK';

export interface RecordPaymentInput {
  businessId: string;
  invoiceId: string;
  amount: number;
  mode: SimplePaymentMode;
  paymentDate?: string;
}

/** Round to paise so float noise never leaves 0.0000001 owed. */
function paise(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Status from bill total and money received so far. */
export function statusForAmounts(total: number, paid: number): 'PAID' | 'PARTIAL' | 'UNPAID' {
  const t = paise(total);
  const p = paise(paid);
  if (p <= 0) return 'UNPAID';
  if (p + 0.005 >= t) return 'PAID';
  return 'PARTIAL';
}

/**
 * Body of recordPayment without its own transaction (so callers can batch).
 * Writes the payment, a ledger credit for the customer (if the bill has one),
 * updates the invoice payment_status, and enqueues all three for sync.
 * Returns the payment id, or null when nothing was recorded.
 */
async function recordPaymentRows(
  db: SQLiteDatabase,
  outbox: OutboxRepository,
  input: RecordPaymentInput
): Promise<string | null> {
  const amount = paise(input.amount);
  if (!(amount > 0)) return null;
  const inv = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM invoices WHERE id = ? AND business_id = ?`,
    [input.invoiceId, input.businessId]
  );
  if (!inv) throw new Error('Bill not found on this device.');
  const date = input.paymentDate ?? localISODate();
  const mode = input.mode;
  const paymentId = newId();

  await db.runAsync(
    `INSERT INTO payments (id, invoice_id, amount, payment_mode, payment_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [paymentId, input.invoiceId, amount, mode, date]
  );
  await outbox.enqueue(
    'payments',
    paymentId,
    'INSERT',
    toSyncPayload('payments', {
      id: paymentId,
      invoice_id: input.invoiceId,
      amount,
      payment_mode: mode,
      payment_date: date,
      created_at: date,
    })
  );

  const customerId = (inv.customer_id as string | null) ?? null;
  if (customerId) {
    const ledgerId = newId();
    const description = `Payment ${String(inv.invoice_number ?? '')} (${mode})`.trim();
    await db.runAsync(
      `INSERT INTO ledger_entries (
         id, business_id, customer_id, invoice_id, payment_id, debit, credit, description, entry_date, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [ledgerId, input.businessId, customerId, input.invoiceId, paymentId, amount, description, date]
    );
    await outbox.enqueue(
      'ledger_entries',
      ledgerId,
      'INSERT',
      toSyncPayload('ledger_entries', {
        id: ledgerId,
        business_id: input.businessId,
        customer_id: customerId,
        invoice_id: input.invoiceId,
        payment_id: paymentId,
        debit: 0,
        credit: amount,
        description,
        entry_date: date,
      })
    );
  }

  const paidRow = await db.getFirstAsync<{ paid: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ?`,
    [input.invoiceId]
  );
  const status = statusForAmounts(Number(inv.total_amount ?? 0), Number(paidRow?.paid ?? 0));
  await db.runAsync(`UPDATE invoices SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    status,
    input.invoiceId,
  ]);
  await outbox.enqueue(
    'invoices',
    input.invoiceId,
    'UPDATE',
    toSyncPayload('invoices', { ...inv, payment_status: status })
  );
  return paymentId;
}

/** Record money received against one bill. */
export async function recordPayment(db: SQLiteDatabase, input: RecordPaymentInput): Promise<string | null> {
  const outbox = new OutboxRepository(db);
  let id: string | null = null;
  await db.withTransactionAsync(async () => {
    id = await recordPaymentRows(db, outbox, input);
  });
  return id;
}

/**
 * "Customer gave ₹X": spread it over their unpaid bills, oldest first.
 * Returns the amount actually applied (never more than they owe).
 */
export async function receiveFromCustomer(
  db: SQLiteDatabase,
  input: { businessId: string; customerId: string; amount: number; mode: SimplePaymentMode; paymentDate?: string }
): Promise<number> {
  const outbox = new OutboxRepository(db);
  let remaining = paise(input.amount);
  let applied = 0;
  if (!(remaining > 0)) return 0;
  await db.withTransactionAsync(async () => {
    const bills = await db.getAllAsync<{ id: string; total_amount: number; paid: number }>(
      `SELECT i.id, i.total_amount,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
       FROM invoices i
       WHERE i.business_id = ? AND i.customer_id = ? AND UPPER(i.payment_status) != 'CANCELLED'
       ORDER BY i.invoice_date, i.created_at`,
      [input.businessId, input.customerId]
    );
    for (const b of bills) {
      if (remaining <= 0) break;
      const due = paise(Number(b.total_amount) - Number(b.paid));
      if (due <= 0) continue;
      const pay = Math.min(due, remaining);
      await recordPaymentRows(db, outbox, {
        businessId: input.businessId,
        invoiceId: b.id,
        amount: pay,
        mode: input.mode,
        paymentDate: input.paymentDate,
      });
      remaining = paise(remaining - pay);
      applied = paise(applied + pay);
    }
  });
  return applied;
}

/* ------------------------------------------------------------------ */
/* Simple-UI read models                                               */
/* ------------------------------------------------------------------ */

export interface DaySummary {
  billsCount: number;
  salesTotal: number;
  cashReceived: number;
  upiReceived: number;
  creditGiven: number;
  owedToYou: number;
}

/** Today's (or any day's) bills and money, plus total owed by all customers. */
export async function getDaySummary(db: SQLiteDatabase, businessId: string, day: string = localISODate()): Promise<DaySummary> {
  const bills = await db.getFirstAsync<{ n: number; total: number; due: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(i.total_amount), 0) AS total,
            COALESCE(SUM(MAX(0, i.total_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0))), 0) AS due
     FROM invoices i
     WHERE i.business_id = ? AND i.invoice_date = ? AND UPPER(i.payment_status) != 'CANCELLED'`,
    [businessId, day]
  );
  const money = await db.getAllAsync<{ mode: string; amt: number }>(
    `SELECT UPPER(COALESCE(p.payment_mode, 'CASH')) AS mode, COALESCE(SUM(p.amount), 0) AS amt
     FROM payments p JOIN invoices i ON i.id = p.invoice_id
     WHERE i.business_id = ? AND p.payment_date = ?
     GROUP BY UPPER(COALESCE(p.payment_mode, 'CASH'))`,
    [businessId, day]
  );
  const owed = await db.getFirstAsync<{ owed: number }>(
    `SELECT COALESCE(SUM(CASE WHEN balance < 0 THEN -balance ELSE 0 END), 0) AS owed
     FROM v_customer_balances WHERE business_id = ?`,
    [businessId]
  );
  let cash = 0;
  let upi = 0;
  for (const m of money) {
    if (m.mode === 'CASH') cash += Number(m.amt) || 0;
    else upi += Number(m.amt) || 0;
  }
  return {
    billsCount: Number(bills?.n ?? 0),
    salesTotal: Number(bills?.total ?? 0),
    cashReceived: paise(cash),
    upiReceived: paise(upi),
    creditGiven: paise(Number(bills?.due ?? 0)),
    owedToYou: paise(Number(owed?.owed ?? 0)),
  };
}

export interface DayBillRow {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  totalAmount: number;
  paid: number;
  paymentStatus: string;
}

export async function listBillsForDay(db: SQLiteDatabase, businessId: string, day: string = localISODate()): Promise<DayBillRow[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT i.id, i.invoice_number, c.name AS customer_name, i.total_amount, i.payment_status,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
     FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.business_id = ? AND i.invoice_date = ? AND UPPER(i.payment_status) != 'CANCELLED'
     ORDER BY i.created_at DESC`,
    [businessId, day]
  );
  return rows.map((r) => ({
    id: String(r.id),
    invoiceNumber: String(r.invoice_number ?? ''),
    customerName: (r.customer_name as string | null) ?? null,
    totalAmount: Number(r.total_amount ?? 0),
    paid: Number(r.paid ?? 0),
    paymentStatus: String(r.payment_status ?? 'UNPAID'),
  }));
}

export interface CustomerBillRow {
  id: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  paid: number;
  due: number;
  paymentStatus: string;
}

export async function listCustomerBills(db: SQLiteDatabase, businessId: string, customerId: string): Promise<CustomerBillRow[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT i.id, i.invoice_number, i.invoice_date, i.total_amount, i.payment_status,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
     FROM invoices i
     WHERE i.business_id = ? AND i.customer_id = ? AND UPPER(i.payment_status) != 'CANCELLED'
     ORDER BY i.invoice_date DESC, i.created_at DESC`,
    [businessId, customerId]
  );
  return rows.map((r) => {
    const total = Number(r.total_amount ?? 0);
    const paid = Number(r.paid ?? 0);
    return {
      id: String(r.id),
      invoiceNumber: String(r.invoice_number ?? ''),
      date: String(r.invoice_date ?? ''),
      totalAmount: total,
      paid,
      due: Math.max(0, paise(total - paid)),
      paymentStatus: String(r.payment_status ?? 'UNPAID'),
    };
  });
}


/**
 * One-tap starter catalogue. Goes through upsertProduct so every row is
 * queued for sync. Items whose name already exists are skipped, so a second
 * tap adds nothing. Returns how many were added.
 */
export async function seedHardwareCatalog(db: SQLiteDatabase, businessId: string): Promise<number> {
  const existing = await db.getAllAsync<{ name: string }>(`SELECT name FROM products WHERE business_id = ?`, [businessId]);
  const have = new Set(existing.map((r) => String(r.name).trim().toLowerCase()));
  let added = 0;
  for (const p of HARDWARE_CATALOG) {
    if (have.has(p.name.toLowerCase())) continue;
    await upsertProduct(
      db,
      businessId,
      {
        id: newId(),
        name: p.name,
        sku: '',
        hsnCode: p.hsn,
        category: p.category,
        unit: p.unit,
        sellingPrice: p.price,
        purchasePrice: 0,
        taxRate: p.gst,
        currentStock: 50,
        minStockLevel: 5,
      },
      true
    );
    have.add(p.name.toLowerCase());
    added += 1;
  }
  return added;
}

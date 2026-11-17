import type { SQLiteDatabase } from 'expo-sqlite';
import { CONFIG } from '../config/env';
import { addDays, localISODate } from '../lib/dates';
import { newId } from '../lib/id';
import { calculateInvoiceTotals, normalizeStateCode, stateNameFor, type GstLineInput } from '../lib/gst';
import { OutboxRepository } from '../sync/outbox';
import { toSyncPayload } from '../sync/syncManager';

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
  customer: {
    id?: string;
    name: string;
    gstin?: string;
    phone?: string;
    email?: string;
    stateCode?: string;
    address?: string;
  };
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
  customer: CreateInvoiceInput['customer']
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
  const invoiceType = input.customer.gstin ? 'B2B' : 'B2C';
  const dueDate =
    input.dueDate ?? (input.paymentTermsDays ? addDays(input.invoiceDate, input.paymentTermsDays) : addDays(input.invoiceDate, 15));
  const invoiceId = newId();

  await db.withTransactionAsync(async () => {
    const customerId = await findOrCreateCustomer(db, outbox, input.businessId, input.customer);

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
}

export async function getFirstBusiness(db: SQLiteDatabase): Promise<BusinessRecord | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM businesses ORDER BY created_at LIMIT 1`
  );
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.business_name ?? 'My Business'),
    gstin: (row.gstin as string | null) ?? null,
    stateCode: normalizeStateCode(String(row.state_code ?? '')) || CONFIG.DEFAULT_STATE_CODE,
    address: (row.address as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    voiceLanguage: (row.voice_language as string | null) ?? null,
  };
}

export async function seedDefaultBusiness(db: SQLiteDatabase): Promise<BusinessRecord> {
  const existing = await getFirstBusiness(db);
  if (existing) return existing;
  const id = newId();
  await db.runAsync(
    `INSERT INTO businesses (
       id, business_name, state_code, voice_language, offline_mode, financial_year_start, created_at, updated_at
     ) VALUES (?, ?, ?, 'ta-IN', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, 'My Business', CONFIG.DEFAULT_STATE_CODE, `${new Date().getFullYear()}-04-01`]
  );
  // Intentionally not enqueued: owner_user_id is required by a future auth flow.
  return (await getFirstBusiness(db))!;
}

export async function updateBusinessProfile(
  db: SQLiteDatabase,
  businessId: string,
  patch: { name?: string; gstin?: string | null; stateCode?: string; address?: string | null; phone?: string | null }
): Promise<void> {
  const outbox = new OutboxRepository(db);
  const current = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM businesses WHERE id = ?`, [businessId]);
  if (!current) return;
  const name = patch.name ?? String(current.business_name);
  const gstin = patch.gstin === undefined ? (current.gstin as string | null) : patch.gstin;
  const stateCode = patch.stateCode ?? String(current.state_code ?? CONFIG.DEFAULT_STATE_CODE);
  const address = patch.address === undefined ? (current.address as string | null) : patch.address;
  const phone = patch.phone === undefined ? (current.phone as string | null) : patch.phone;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE businesses SET business_name = ?, gstin = ?, state_code = ?, address = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, gstin, normalizeStateCode(stateCode) || CONFIG.DEFAULT_STATE_CODE, address, phone, businessId]
    );
    const payload = {
      id: businessId,
      owner_user_id: current.owner_user_id ?? null,
      business_name: name,
      gstin,
      address,
      phone,
      financial_year_start: current.financial_year_start ?? null,
      voice_language: current.voice_language ?? null,
      offline_mode: current.offline_mode ?? 1,
      printer_settings: current.printer_settings ?? null,
      created_at: current.created_at ?? localISODate(),
    };
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

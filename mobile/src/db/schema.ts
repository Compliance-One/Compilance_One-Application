/**
 * Member 1 — Core Infrastructure, Local DB & Sync
 * mobile/src/db/schema.ts
 *
 * Full drizzle-orm SQLite table definitions.
 * Mirrors the Postgres ER schema exactly so the sync layer
 * can do a 1-to-1 push/pull without any field mapping.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const now = () => sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// ─── users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey(),            // UUID
  name:         text('name').notNull(),
  phone:        text('phone').notNull().unique(),
  email:        text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    text('created_at').notNull().default(now()),
  updatedAt:    text('updated_at').notNull().default(now()),
});

// ─── businesses ──────────────────────────────────────────────────────────────
export const businesses = sqliteTable('businesses', {
  id:                 text('id').primaryKey(),
  ownerUserId:        text('owner_user_id').notNull().references(() => users.id),
  businessName:       text('business_name').notNull(),
  gstin:              text('gstin').unique(),
  address:            text('address'),
  phone:              text('phone'),
  stateCode:          text('state_code'),           // e.g. "33" for Tamil Nadu
  financialYearStart: text('financial_year_start'),  // ISO date "YYYY-MM-DD"
  voiceLanguage:      text('voice_language').notNull().default('ta'),
  offlineMode:        integer('offline_mode', { mode: 'boolean' }).notNull().default(true),
  printerSettings:    text('printer_settings', { mode: 'json' }), // { deviceName, paperWidth }
  createdAt:          text('created_at').notNull().default(now()),
  updatedAt:          text('updated_at').notNull().default(now()),
});

// ─── products ────────────────────────────────────────────────────────────────
export const products = sqliteTable('products', {
  id:            text('id').primaryKey(),
  businessId:    text('business_id').notNull().references(() => businesses.id),
  name:          text('name').notNull(),
  hsnCode:       text('hsn_code').notNull(),
  gstRate:       real('gst_rate').notNull(),         // e.g. 18.0
  unit:          text('unit').notNull().default('PCS'),
  price:         real('price').notNull().default(0),
  stockQuantity: real('stock_quantity').notNull().default(0),
  isActive:      integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:     text('created_at').notNull().default(now()),
  updatedAt:     text('updated_at').notNull().default(now()),
});

// ─── customers ───────────────────────────────────────────────────────────────
export const customers = sqliteTable('customers', {
  id:           text('id').primaryKey(),
  businessId:   text('business_id').notNull().references(() => businesses.id),
  name:         text('name').notNull(),
  phone:        text('phone'),
  address:      text('address'),
  gstin:        text('gstin'),                       // nullable — B2B only
  customerType: text('customer_type').notNull().default('B2C'), // 'B2B' | 'B2C'
  createdAt:    text('created_at').notNull().default(now()),
  updatedAt:    text('updated_at').notNull().default(now()),
});

// ─── invoices ────────────────────────────────────────────────────────────────
export const invoices = sqliteTable('invoices', {
  id:             text('id').primaryKey(),
  businessId:     text('business_id').notNull().references(() => businesses.id),
  customerId:     text('customer_id').references(() => customers.id),
  invoiceNumber:  text('invoice_number').notNull(),
  invoiceDate:    text('invoice_date').notNull(),    // ISO date
  invoiceType:    text('invoice_type').notNull().default('B2C'), // 'B2B' | 'B2C'
  subtotal:       real('subtotal').notNull().default(0),
  discount:       real('discount').notNull().default(0),
  taxableAmount:  real('taxable_amount').notNull().default(0),
  cgst:           real('cgst').notNull().default(0),
  sgst:           real('sgst').notNull().default(0),
  igst:           real('igst').notNull().default(0),
  totalTax:       real('total_tax').notNull().default(0),
  grandTotal:     real('grand_total').notNull().default(0),
  paymentStatus:  text('payment_status').notNull().default('unpaid'), // 'paid' | 'partial' | 'unpaid'
  notes:          text('notes'),
  voiceLogId:     text('voice_log_id'),
  isGstr1Filed:   integer('is_gstr1_filed', { mode: 'boolean' }).notNull().default(false),
  createdAt:      text('created_at').notNull().default(now()),
  updatedAt:      text('updated_at').notNull().default(now()),
});

// ─── invoice_items ───────────────────────────────────────────────────────────
export const invoiceItems = sqliteTable('invoice_items', {
  id:           text('id').primaryKey(),
  invoiceId:    text('invoice_id').notNull().references(() => invoices.id),
  productId:    text('product_id').references(() => products.id),
  productName:  text('product_name').notNull(),      // snapshot at time of billing
  hsnCode:      text('hsn_code').notNull(),
  quantity:     real('quantity').notNull(),
  unit:         text('unit').notNull().default('PCS'),
  rate:         real('rate').notNull(),
  discount:     real('discount').notNull().default(0),
  taxableAmount:real('taxable_amount').notNull(),
  gstRate:      real('gst_rate').notNull(),
  cgst:         real('cgst').notNull().default(0),
  sgst:         real('sgst').notNull().default(0),
  igst:         real('igst').notNull().default(0),
  total:        real('total').notNull(),
  createdAt:    text('created_at').notNull().default(now()),
});

// ─── payments ────────────────────────────────────────────────────────────────
export const payments = sqliteTable('payments', {
  id:            text('id').primaryKey(),
  businessId:    text('business_id').notNull().references(() => businesses.id),
  invoiceId:     text('invoice_id').notNull().references(() => invoices.id),
  amount:        real('amount').notNull(),
  paymentDate:   text('payment_date').notNull(),
  paymentMode:   text('payment_mode').notNull().default('cash'), // 'cash'|'upi'|'bank'|'credit'
  reference:     text('reference'),
  notes:         text('notes'),
  createdAt:     text('created_at').notNull().default(now()),
  updatedAt:     text('updated_at').notNull().default(now()),
});

// ─── expenses ────────────────────────────────────────────────────────────────
export const expenses = sqliteTable('expenses', {
  id:           text('id').primaryKey(),
  businessId:   text('business_id').notNull().references(() => businesses.id),
  category:     text('category').notNull(),          // 'rent'|'electricity'|'purchase'|'other'
  description:  text('description'),
  amount:       real('amount').notNull(),
  expenseDate:  text('expense_date').notNull(),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:    text('created_at').notNull().default(now()),
  updatedAt:    text('updated_at').notNull().default(now()),
});

// ─── ledger_entries ──────────────────────────────────────────────────────────
export const ledgerEntries = sqliteTable('ledger_entries', {
  id:          text('id').primaryKey(),
  businessId:  text('business_id').notNull().references(() => businesses.id),
  customerId:  text('customer_id').references(() => customers.id),
  invoiceId:   text('invoice_id').references(() => invoices.id),
  paymentId:   text('payment_id').references(() => payments.id),
  entryDate:   text('entry_date').notNull(),
  description: text('description').notNull(),
  debit:       real('debit').notNull().default(0),   // amount owed TO business
  credit:      real('credit').notNull().default(0),  // amount paid BY customer
  // NOTE: balance is NEVER stored — always computed by the view
  createdAt:   text('created_at').notNull().default(now()),
});

// ─── gstr1_exports ───────────────────────────────────────────────────────────
export const gstr1Exports = sqliteTable('gstr1_exports', {
  id:             text('id').primaryKey(),
  businessId:     text('business_id').notNull().references(() => businesses.id),
  periodFrom:     text('period_from').notNull(),
  periodTo:       text('period_to').notNull(),
  totalInvoices:  integer('total_invoices').notNull().default(0),
  totalB2b:       integer('total_b2b').notNull().default(0),
  totalB2c:       integer('total_b2c').notNull().default(0),
  jsonPayload:    text('json_payload'),               // full GSTR-1 JSON
  exportedAt:     text('exported_at').notNull().default(now()),
  createdAt:      text('created_at').notNull().default(now()),
});

// ─── voice_transaction_logs ──────────────────────────────────────────────────
export const voiceTransactionLogs = sqliteTable('voice_transaction_logs', {
  id:             text('id').primaryKey(),
  businessId:     text('business_id').notNull().references(() => businesses.id),
  invoiceId:      text('invoice_id').references(() => invoices.id),
  rawTranscript:  text('raw_transcript').notNull(),
  parsedOutput:   text('parsed_output', { mode: 'json' }),
  confidenceScore:real('confidence_score'),
  sttMethod:      text('stt_method').notNull().default('on-device'), // 'on-device'|'cloud'
  languageCode:   text('language_code').notNull().default('ta-IN'),
  createdAt:      text('created_at').notNull().default(now()),
});

// ─── suppliers ───────────────────────────────────────────────────────────────
export const suppliers = sqliteTable('suppliers', {
  id:          text('id').primaryKey(),
  businessId:  text('business_id').notNull().references(() => businesses.id),
  name:        text('name').notNull(),
  phone:       text('phone'),
  gstin:       text('gstin'),
  address:     text('address'),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:   text('created_at').notNull().default(now()),
  updatedAt:   text('updated_at').notNull().default(now()),
});

// ─── purchases ───────────────────────────────────────────────────────────────
export const purchases = sqliteTable('purchases', {
  id:           text('id').primaryKey(),
  businessId:   text('business_id').notNull().references(() => businesses.id),
  supplierId:   text('supplier_id').references(() => suppliers.id),
  invoiceRef:   text('invoice_ref'),
  purchaseDate: text('purchase_date').notNull(),
  totalAmount:  real('total_amount').notNull(),
  isPaid:       integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  notes:        text('notes'),
  createdAt:    text('created_at').notNull().default(now()),
  updatedAt:    text('updated_at').notNull().default(now()),
});

// ─── sync_outbox ─────────────────────────────────────────────────────────────
// Append-only queue: every local write is recorded here for sync push
export const syncOutbox = sqliteTable('sync_outbox', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  tableName:  text('table_name').notNull(),           // e.g. 'invoices'
  operation:  text('operation').notNull(),            // 'INSERT'|'UPDATE'|'DELETE'
  recordId:   text('record_id').notNull(),            // UUID of the affected row
  payload:    text('payload', { mode: 'json' }).notNull(),
  syncedAt:   text('synced_at'),                      // NULL = not yet synced
  createdAt:  text('created_at').notNull().default(now()),
});

// ─── Type exports ─────────────────────────────────────────────────────────────
export type User                  = typeof users.$inferSelect;
export type Business              = typeof businesses.$inferSelect;
export type Product               = typeof products.$inferSelect;
export type Customer              = typeof customers.$inferSelect;
export type Invoice               = typeof invoices.$inferSelect;
export type InvoiceItem           = typeof invoiceItems.$inferSelect;
export type Payment               = typeof payments.$inferSelect;
export type Expense               = typeof expenses.$inferSelect;
export type LedgerEntry           = typeof ledgerEntries.$inferSelect;
export type Gstr1Export           = typeof gstr1Exports.$inferSelect;
export type VoiceTransactionLog   = typeof voiceTransactionLogs.$inferSelect;
export type Supplier              = typeof suppliers.$inferSelect;
export type Purchase              = typeof purchases.$inferSelect;
export type SyncOutboxEntry       = typeof syncOutbox.$inferSelect;

export type NewInvoice     = typeof invoices.$inferInsert;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type NewProduct     = typeof products.$inferInsert;
export type NewCustomer    = typeof customers.$inferInsert;
export type NewPayment     = typeof payments.$inferInsert;
export type NewExpense     = typeof expenses.$inferInsert;

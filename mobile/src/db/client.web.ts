/**
 * Member 1 — Web Platform DB Client
 * mobile/src/db/client.web.ts
 *
 * Dedicated Web client for Compliance One.
 * Metro automatically resolves this file on Web browsers.
 * Provides a responsive in-memory database with pre-seeded demo catalog
 * so all screens (Products, Inventory, Invoices, Reports) work out of the box in browser.
 */

import * as schema from './schema';

// ─── Initial Demo Products & Customers ────────────────────────────────────────
const initialProducts = [
  { id: 'p1', businessId: 'demo-biz', name: 'Basmati Rice 1kg (அரிசி)', hsnCode: '1006', gstRate: 5, unit: 'KG', price: 120, stockQuantity: 50, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p2', businessId: 'demo-biz', name: 'Sugar 1kg (சர்க்கரை)', hsnCode: '1701', gstRate: 5, unit: 'KG', price: 45, stockQuantity: 100, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p3', businessId: 'demo-biz', name: 'Sunflower Oil 1L (எண்ணெய்)', hsnCode: '1512', gstRate: 5, unit: 'LTR', price: 140, stockQuantity: 40, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p4', businessId: 'demo-biz', name: 'Toor Dal 1kg (துவரம் பருப்பு)', hsnCode: '0713', gstRate: 0, unit: 'KG', price: 160, stockQuantity: 30, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p5', businessId: 'demo-biz', name: 'Aavin Milk 500ml (பால்)', hsnCode: '0401', gstRate: 0, unit: 'PKT', price: 25, stockQuantity: 60, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p6', businessId: 'demo-biz', name: 'Tea Powder 250g (தேயிலை)', hsnCode: '0902', gstRate: 5, unit: 'PKT', price: 95, stockQuantity: 45, isActive: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const initialCustomers = [
  { id: 'c1', businessId: 'demo-biz', name: 'Senthil Kumar (செந்தில்)', phone: '9840123456', address: 'Chennai', customerType: 'B2C', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2', businessId: 'demo-biz', name: 'Murugan Traders', phone: '9840987654', address: 'Madurai', gstin: '33AAAAA0000A1Z5', customerType: 'B2B', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const initialInvoices = [
  { id: 'inv-101', businessId: 'demo-biz', customerId: 'c1', invoiceNumber: 'INV-0001', invoiceDate: new Date().toISOString(), invoiceType: 'B2C', subtotal: 305, discount: 0, taxableAmount: 305, cgst: 7.25, sgst: 7.25, igst: 0, totalTax: 14.5, grandTotal: 319.5, paymentStatus: 'paid', notes: 'Voice billed', isGstr1Filed: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const webStore: Record<string, any[]> = {
  products: [...initialProducts],
  customers: [...initialCustomers],
  invoices: [...initialInvoices],
  invoice_items: [],
  payments: [],
  expenses: [],
  ledger_entries: [],
  sync_outbox: [],
  gstr1_exports: [],
  voice_transaction_logs: [],
  businesses: [{ id: 'demo-biz', ownerUserId: '1', businessName: 'Demo Store', voiceLanguage: 'ta', offlineMode: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
};

function getTableName(tableObj: any): string {
  if (!tableObj) return 'products';
  if (typeof tableObj === 'string') return tableObj;
  const symbolName = Object.getOwnPropertySymbols(tableObj).find(s => s.description === 'drizzle:Name' || s.description === 'drizzle:OriginalName');
  if (symbolName) return (tableObj as any)[symbolName];
  if (tableObj._?.name) return tableObj._.name;
  if (tableObj.name) return tableObj.name;
  return 'products';
}

function createWebDb(): any {
  return {
    select: (fields?: any) => {
      let currentTable = 'products';
      let limitCount: number | null = null;
      let offsetCount = 0;

      const executeQuery = () => {
        let list = webStore[currentTable] || [];
        if (fields && typeof fields === 'object' && ('count' in fields || 'total' in fields)) {
          const grandTotal = list.reduce((acc: number, item: any) => acc + (Number(item.grandTotal) || Number(item.amount) || 0), 0);
          return [{ count: list.length, total: grandTotal }];
        }
        if (offsetCount > 0) list = list.slice(offsetCount);
        if (limitCount !== null) list = list.slice(0, limitCount);
        return [...list];
      };

      const queryObj: any = {
        from: (tbl: any) => {
          currentTable = getTableName(tbl);
          return queryObj;
        },
        where: () => queryObj,
        orderBy: () => queryObj,
        limit: (n: number) => {
          limitCount = n;
          return queryObj;
        },
        offset: (n: number) => {
          offsetCount = n;
          return queryObj;
        },
        groupBy: () => queryObj,
        having: () => queryObj,
        leftJoin: () => queryObj,
        innerJoin: () => queryObj,
        execute: async () => executeQuery(),
        all: async () => executeQuery(),
        get: async () => executeQuery()[0],
        then: (resolve: (val: any) => void, reject?: (err: any) => void) => {
          try {
            const res = executeQuery();
            return Promise.resolve(resolve(res));
          } catch (e) {
            if (reject) return Promise.resolve(reject(e));
            return Promise.reject(e);
          }
        },
        catch: (reject: (err: any) => void) => {
          return queryObj.then(undefined, reject);
        },
        finally: (cb: () => void) => {
          return queryObj.then((v: any) => { cb(); return v; }, (e: any) => { cb(); throw e; });
        },
      };
      return queryObj;
    },
    insert: (tbl: any) => ({
      values: (val: any) => {
        const table = getTableName(tbl);
        if (!webStore[table]) webStore[table] = [];
        if (Array.isArray(val)) {
          webStore[table].push(...val);
        } else if (val) {
          webStore[table].push(val);
        }
        return Promise.resolve();
      },
    }),
    update: (tbl: any) => ({
      set: (val: any) => ({
        where: () => {
          const table = getTableName(tbl);
          if (webStore[table] && webStore[table].length > 0 && val) {
            Object.assign(webStore[table][0], val);
          }
          return Promise.resolve();
        },
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
    get: async <T>(query: any): Promise<T | undefined> => {
      const qStr = typeof query === 'string' ? query : (query?.text || '');
      if (qStr.includes('cashAndBank')) {
        return { cashAndBank: 15400, stockValue: 8500, receivables: 4200, payables: 1800 } as unknown as T;
      }
      if (qStr.includes('salesTotal')) {
        return { salesTotal: 25000, invoiceCount: 14 } as unknown as T;
      }
      return { value: '0', balance: 0 } as unknown as T;
    },
    all: async <T>(query: any): Promise<T[]> => {
      const qStr = typeof query === 'string' ? query : (query?.text || '');
      if (qStr.includes('expense')) {
        return [{ category: 'Rent', amount: 5000 }, { category: 'Electricity', amount: 1200 }] as unknown as T[];
      }
      if (qStr.includes('customerBalances') || qStr.includes('balance')) {
        return [
          { customerId: 'c1', customerName: 'Senthil Kumar (செந்தில்)', phone: '9840123456', totalDebit: 500, totalCredit: 200, balance: 300 },
          { customerId: 'c2', customerName: 'Murugan Traders', phone: '9840987654', totalDebit: 1200, totalCredit: 1200, balance: 0 }
        ] as unknown as T[];
      }
      return [] as T[];
    },
    run: async () => Promise.resolve(),
  };
}

export const db = createWebDb();

export async function initDatabase(): Promise<void> {
  console.log('[Web DB] Initialized with pre-seeded demo inventory & customer data.');
  return Promise.resolve();
}

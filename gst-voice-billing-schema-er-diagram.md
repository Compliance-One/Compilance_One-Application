# GST Voice Billing App — Database Schema (v2, normalized)
 
Target stack: PostgreSQL on Neon (serverless) · offline-first mobile client syncing to this schema.
 

erDiagram
    users ||--o{ businesses : owns
    businesses ||--o{ products : stocks
    businesses ||--o{ customers : maintains
    businesses ||--o{ invoices : issues
    businesses ||--o{ expenses : records
    businesses ||--o{ gstr1_exports : generates
    businesses ||--o{ ledger_entries : tracks
    businesses ||--o{ voice_transaction_logs : logs
    businesses ||--o{ suppliers : "sources from (optional)"
    businesses ||--o{ purchases : "records (optional)"
    customers ||--o{ invoices : receives
    customers ||--o{ ledger_entries : has
    invoices ||--o{ invoice_items : contains
    products ||--o{ invoice_items : "sold as"
    invoices ||--o{ payments : receives
    invoices |o--o{ ledger_entries : generates
    payments |o--o{ ledger_entries : generates
    invoices |o--o{ voice_transaction_logs : "captured via"
    suppliers ||--o{ purchases : bills
 
    users {
        uuid id PK
        varchar name
        varchar phone UK
        varchar email UK
        text password_hash
        timestamp created_at
    }
 
    businesses {
        uuid id PK
        uuid owner_user_id FK
        varchar business_name
        varchar gstin UK
        text address
        varchar phone
        date financial_year_start
        varchar voice_language
        boolean offline_mode
        jsonb printer_settings
        timestamp created_at
    }
 
    products {
        uuid id PK
        uuid business_id FK
        varchar name
        varchar hsn_code
        numeric gst_rate
        varchar unit
        numeric price
        numeric stock_quantity
        timestamp created_at
    }
 
    customers {
        uuid id PK
        uuid business_id FK
        varchar name
        varchar phone
        text address
        varchar gstin "nullable, B2B only"
        varchar customer_type "B2B or B2C"
        timestamp created_at
    }
 
    invoices {
        uuid id PK
        uuid business_id FK
        uuid customer_id FK
        varchar invoice_number UK "unique per business"
        date invoice_date
        varchar invoice_type "B2B or B2C"
        numeric subtotal
        numeric discount
        numeric taxable_amount
        numeric cgst_amount
        numeric sgst_amount
        numeric igst_amount
        numeric total_amount
        varchar payment_status
        varchar input_mode "voice or text"
        varchar sync_status "offline-first sync state"
        timestamp created_at
    }
 
    invoice_items {
        uuid id PK
        uuid invoice_id FK
        uuid product_id FK
        numeric quantity
        numeric unit_price
        varchar hsn_code "snapshot at sale time"
        numeric gst_rate "snapshot at sale time"
        numeric discount
        numeric taxable_value
        numeric cgst_amount
        numeric sgst_amount
        numeric igst_amount
        numeric line_total
    }
 
    payments {
        uuid id PK
        uuid invoice_id FK
        numeric amount
        varchar payment_mode
        date payment_date
        timestamp created_at
    }
 
    ledger_entries {
        uuid id PK
        uuid business_id FK
        uuid customer_id FK
        uuid invoice_id FK "nullable"
        uuid payment_id FK "nullable"
        numeric debit
        numeric credit
        text description "nullable, esp. for manual adjustments"
        date entry_date
    }
 
    expenses {
        uuid id PK
        uuid business_id FK
        varchar category
        text description
        numeric amount
        date expense_date
        timestamp created_at
    }
 
    gstr1_exports {
        uuid id PK
        uuid business_id FK
        date period_from
        date period_to
        integer total_invoices
        integer total_b2b
        integer total_b2c
        text json_file_path
        varchar status
        timestamp generated_at
    }
 
    voice_transaction_logs {
        uuid id PK
        uuid business_id FK
        uuid invoice_id FK "nullable"
        text raw_transcript
        jsonb parsed_json
        varchar language
        varchar input_mode "voice or text"
        timestamp created_at
    }
 
    suppliers {
        uuid id PK
        uuid business_id FK
        varchar name
        varchar gstin "nullable"
        varchar phone
        text address
        timestamp created_at
    }
 
    purchases {
        uuid id PK
        uuid business_id FK
        uuid supplier_id FK
        varchar bill_number
        date purchase_date
        numeric amount
        varchar payment_status "paid or unpaid — drives payables"
        timestamp created_at
    }
```
 
## Normal form
 
- **1NF–3NF/BCNF:** satisfied. No repeating groups, no partial or transitive dependencies. `printer_settings` and `parsed_json` (jsonb) are semi-structured payloads by design, not relational attributes — the accepted exception to strict atomicity for that use case.
- **4NF:** already satisfied in v1, and unchanged here. 4NF is violated when independent multi-valued facts about the same key are packed into one relation; this schema never did that — a business's products, customers, invoices, and expenses were already separate relations. There was no MVD to fix.
- **The real fix in this revision:** `ledger_entries.balance` was a stored running total — a cached derived value, not a normalization violation in the classic sense, but a correctness risk specific to your offline-first architecture. Two devices can each append ledger rows while offline and compute a locally-consistent-but-mutually-divergent `balance`; whichever syncs last silently overwrites the other's number. Removing the column and computing balance as a view eliminates the conflict entirely — there's nothing to merge, because nothing is stored:
```sql
CREATE VIEW customer_balances AS
SELECT business_id, customer_id, SUM(credit) - SUM(debit) AS balance
FROM ledger_entries
GROUP BY business_id, customer_id;
```
 
For a per-customer statement (running balance over time, not just current), the same idea works as a window function:
 
```sql
SELECT *, SUM(credit - debit) OVER (
  PARTITION BY customer_id ORDER BY entry_date, id
) AS running_balance
FROM ledger_entries
WHERE customer_id = $1
ORDER BY entry_date, id;
```
 
- **Everything else stays intentionally denormalized**, for reasons unrelated to the ledger problem: `invoices`/`invoice_items` totals are either perf caches (safe — invoices aren't edited after creation, no sync-conflict path) or legally-required snapshots (HSN/GST rate at sale time). `gstr1_exports` aggregate counts are a frozen audit record of what was actually exported, not a live entity. None of these carry the same risk as a mutable cached ledger balance.
- **`suppliers` + `purchases` are optional.** Add them only if the Balance Sheet's payables line needs to be real; otherwise drop this pair and scope the Balance Sheet to assets + owner's capital, as flagged earlier.
 

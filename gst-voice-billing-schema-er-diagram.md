# GST Voice Billing App — Database Schema (ER Diagram)

Target stack: PostgreSQL on Neon (serverless) · offline-first mobile client syncing to this schema.

```mermaid
erDiagram
    users ||--o{ businesses : owns
    businesses ||--o{ products : stocks
    businesses ||--o{ customers : maintains
    businesses ||--o{ invoices : issues
    businesses ||--o{ expenses : records
    businesses ||--o{ gstr1_exports : generates
    businesses ||--o{ ledger_entries : tracks
    businesses ||--o{ voice_transaction_logs : logs
    customers ||--o{ invoices : receives
    customers ||--o{ ledger_entries : has
    invoices ||--o{ invoice_items : contains
    products ||--o{ invoice_items : "sold as"
    invoices ||--o{ payments : receives
    invoices |o--o{ ledger_entries : generates
    payments |o--o{ ledger_entries : generates
    invoices |o--o{ voice_transaction_logs : "captured via"

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
        numeric balance
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
```

## Notes

- Reports, Profit & Loss, and Balance Sheet screens are computed views over `invoices`, `invoice_items`, `expenses`, `ledger_entries`, and `products.stock_quantity` — not separate stored tables.
- `ledger_entries.invoice_id` and `ledger_entries.payment_id` are both nullable; each row originates from exactly one of: an invoice (debit), a payment (credit), or a manual adjustment (both null).
- UUID primary keys throughout (not serial/identity) to avoid ID collisions when offline-created records sync from the mobile client to Neon.
- `invoices.invoice_number` is unique per `business_id`, not globally.
- `invoice_items.hsn_code` / `gst_rate` snapshot the product's values at sale time, since `products.gst_rate` can change later and past invoices must keep their original rate.
- `invoices.sync_status` and `voice_transaction_logs` support the offline-first flow: local SQLite writes queue up and sync to Neon Postgres when connectivity returns.

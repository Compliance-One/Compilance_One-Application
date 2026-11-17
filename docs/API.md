# Backend API reference

[← Back to README](../README.md) · [Screens](SCREENS.md) · [Troubleshooting](TROUBLESHOOTING.md)

- **Base URL:** `http://<host>:8000/api/v1` (on the phone over USB: `http://localhost:8000/api/v1` after `adb reverse tcp:8000 tcp:8000`).
- **Interactive docs (Swagger):** `http://localhost:8000/docs` — every route below can be tried there. Click **Authorize** and paste the `access_token`.
- **Health:** `GET /` (no `/api/v1`) → `{"app":"Compliance One API","status":"online","version":"1.0.0",...}`
- Source: `backend/app/main.py`, `backend/app/api/v1/*.py`.

## Contents

- [Authentication](#authentication)
- [Route overview](#route-overview)
- [Auth](#auth-apiv1auth)
- [Sync (push / pull)](#sync-push--pull)
- [Reports](#reports-apiv1reports)
- [Customer ledger](#customer-ledger-apiv1customers-ledger)
- [GSTR-1 export records](#gstr-1-export-records-apiv1gstr1)
- [Demo (in-memory) routers](#demo-in-memory-routers): business, products, invoices, payments, expenses, suppliers
- [Common errors](#common-errors)

## Authentication

| Item | Value |
|---|---|
| Scheme | `Authorization: Bearer <access_token>` (JWT, HS256, claim `typ: "access"`) |
| Access token life | `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30 min) |
| Refresh token | Opaque random string; only its SHA-256 hash is stored. Each `/auth/refresh` **rotates** it (old one is revoked). Lifetime `REFRESH_TOKEN_EXPIRE_DAYS` (default 30). |
| Mobile behaviour | `mobile/src/api/client.ts` retries a request once after a 401 by calling `/auth/refresh` automatically. |
| Business ownership | Business-scoped routes take `?business_id=<uuid>` and return **404 "Business not found"** if the server has no such business and **403 "You do not own this business"** if it belongs to another user. |

<details>
<summary>PowerShell: register, then call a protected route</summary>

```powershell
$base = "http://localhost:8000/api/v1"
$body = @{ name = "Sathyan"; phone = "9876543210"; password = "password123" } | ConvertTo-Json
$tok  = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body $body
# (use /auth/login with @{identifier="9876543210"; password="password123"} if already registered)
$h = @{ Authorization = "Bearer $($tok.access_token)" }
Invoke-RestMethod -Uri "$base/auth/me" -Headers $h
```
</details>

## Route overview

| Method | Path | Auth | Storage | Used by the app |
|---|---|---|---|---|
| POST | `/auth/register` | — | SQLite | ✅ Register |
| POST | `/auth/login` | — | SQLite | ✅ Login |
| POST | `/auth/refresh` | — | SQLite | ✅ automatic |
| POST | `/auth/logout` | — | SQLite | ✅ Log out |
| GET | `/auth/me` | Bearer | SQLite | ✅ session check |
| POST | `/sync/push` | Bearer | SQLite | ✅ sync loop |
| GET | `/sync/pull` | Bearer + owner | SQLite | ✅ sync loop |
| GET | `/reports/profit-loss` | Bearer + owner | SQLite views | — |
| GET | `/reports/balance-sheet` | Bearer + owner | SQLite views | — |
| GET | `/reports/dashboard-summary` | Bearer + owner | SQLite views | — |
| GET | `/reports/export/excel` | Bearer + owner | SQLite views | — |
| GET | `/customers-ledger/balances` | Bearer + owner | SQLite views | — |
| GET | `/customers-ledger/{customer_id}/statement` | Bearer + owner | SQLite views | — |
| POST | `/gstr1` | Bearer + owner | SQLite | — (⚠️ fails on SQLite, see below) |
| GET | `/gstr1` | Bearer + owner | SQLite | — |
| GET/POST/PUT | `/business`, GET `/business/states`, GET `/business/verify-gstin/{gstin}` | Bearer | **in-memory** | — |
| GET/POST/PUT/DELETE | `/products…` | Bearer | **in-memory** | — |
| GET/POST/PATCH | `/invoices…` | Bearer | **in-memory** | — |
| GET/POST | `/payments…` | Bearer | **in-memory** | — |
| GET/POST/PUT/DELETE | `/expenses…` | Bearer | **in-memory** | — |
| GET/POST/PUT/DELETE | `/suppliers…` | Bearer | **in-memory** | — |

> The reports, ledger and GSTR-1 routes read the **synced** data (tables and SQL views created by the Alembic baseline). The phone computes the same reports locally, so it does not call them.

---

## Auth (`/api/v1/auth`)

### POST `/auth/register` → 201

```json
// request
{ "name": "Sathyan", "phone": "9876543210", "password": "password123", "email": "me@example.com" }
```
Rules: `name` 1–200 chars, `phone` 8–20 chars, `password` 8–128 chars, `email` optional.

```json
// response (same shape for login and refresh)
{
  "access_token": "eyJhbGciOi…",
  "refresh_token": "q2V…",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": { "id": "3f6c…-uuid", "name": "Sathyan", "phone": "9876543210", "email": "me@example.com" }
}
```
Errors: **409** `Phone or email already registered`; **422** validation (e.g. short password); **404** if the URL lacks `/api/v1`.

### POST `/auth/login` → 200

```json
{ "identifier": "9876543210", "password": "password123" }
```
`identifier` = phone **or** email. Errors: **401** `Invalid credentials`.

### POST `/auth/refresh` → 200

```json
{ "refresh_token": "q2V…" }
```
Returns a new token pair; the old refresh token is revoked. Errors: **401** `Invalid refresh token` (unknown, revoked or expired) / `User not found`.

### POST `/auth/logout` → 204

`{ "refresh_token": "q2V…" }` — revokes it. Always 204 (even for unknown tokens).

### GET `/auth/me` → 200

Header `Authorization: Bearer …` → `{ "id": "…", "name": "…", "phone": "…", "email": null }`.
Errors: **401** `Not authenticated` / `Invalid or expired token` / `Invalid token type` / `User not found`.

---

## Sync (push / pull)

Source: `backend/app/api/v1/sync.py`, `backend/app/services/sync_reconciler.py`, `mobile/src/sync/syncManager.ts`, `mobile/src/sync/outbox.ts`.

### Entities

`businesses`, `customers`, `products`, `invoices`, `invoice_items`, `payments`, `expenses`, `ledger_entries`, `suppliers`, `purchases`, `voice_transaction_logs`, `gstr1_exports` (and `users`, which is **never** accepted through sync — users are created only via `/auth`).

Apply order (server and phone): users → businesses → suppliers → customers → products → purchases → invoices → invoice_items → payments → expenses → ledger_entries → voice_transaction_logs → gstr1_exports. `DELETE`s are applied in reverse order (children first).

### POST `/sync/push` → 200

```json
// request
{
  "items": [
    {
      "outbox_id": 41,
      "entity_type": "businesses",
      "entity_id": "1466c377-7435-4371-92ac-e647a428da7c",
      "operation": "INSERT",
      "data": { "business_name": "Murugan Hardwares", "state_code": "33", "gstin": "33ABCDE1234F1Z5" }
    },
    {
      "outbox_id": 42,
      "entity_type": "customers",
      "entity_id": "9b0e…",
      "operation": "INSERT",
      "data": { "business_id": "1466c377-…", "name": "Ravi", "gstin": null, "customer_type": "B2C" }
    }
  ]
}
```

```json
// response
{ "processed_ids": [41, 42], "failed_ids": [] }
```

Server rules for each item:

| Rule | Result |
|---|---|
| Unknown `entity_type`, `users`, non-UUID `entity_id`, unknown `operation` | `failed_ids` |
| Item's business (from `data.business_id`, or the parent invoice for `invoice_items`/`payments`) is not owned by the caller | `failed_ids` |
| A `businesses` item that is new (or unowned) | accepted and **claimed**: `owner_user_id` = the caller |
| `INSERT` / `UPDATE` | **upsert** by `id` (insert or overwrite); unknown columns are dropped; `""` GSTIN becomes `NULL`; ISO / SQLite timestamps parsed |
| `DELETE` | delete by `id` |
| Any DB error | that item only is rolled back (savepoint) → `failed_ids`; others still succeed |

### GET `/sync/pull?business_id=<uuid>&since=<iso-datetime>` → 200

```json
{
  "server_time": "2026-11-18T09:30:00.123456+00:00",
  "changes": {
    "businesses": [ { "id": "1466c377-…", "business_name": "Murugan Hardwares", "offline_mode": 1, … } ],
    "customers":  [ … ],
    "products":   [ … ],
    "invoices": [], "invoice_items": [], "payments": [], "expenses": [], "ledger_entries": [],
    "users": [], "suppliers": [], "purchases": [], "voice_transaction_logs": [], "gstr1_exports": []
  }
}
```

- Rows are filtered by business (children of invoices via their invoice). With `since`, only rows with `created_at > since` are returned.
- UUIDs → strings, datetimes → ISO strings, booleans → `0/1`, decimals → numbers.
- Errors: **404** `Business not found` (server never received this business), **403** `You do not own this business`, **401** auth.

### Phone outbox behaviour

| Step | What happens |
|---|---|
| Every local save | Row written + outbox item `PENDING` (same transaction) |
| Loop | Starts at app start (if signed in) or right after login; runs once immediately, then **every 30 s**. Network status (NetInfo) is tracked for the online/offline indicator; when the network returns, the next 30-second tick catches up |
| Push | Up to 20 batches × 50 items, sorted parent-first; items marked `PROCESSING` |
| Response | `processed_ids` → `COMPLETED`; `failed_ids` and anything not acknowledged → `FAILED`, `attempts + 1` |
| Retries | `FAILED` items are retried until `attempts` reaches **5** (`MAX_RETRY_COUNT`) |
| Stuck items | `PROCESSING` for more than 60 s → back to `FAILED` (counted) |
| Network error | Whole batch `FAILED` (+1 attempt); loop tries again later |
| Business accepted | Other earlier-failed items are re-queued (they likely failed only because the business was missing) |
| Pull 404 "Business not found" | The phone re-queues its business row as a fresh `INSERT`, revives failed items, pushes again, then does a **full** pull (no `since`) |
| Pull apply | Upserts rows in priority order, **skipping rows that still have unsent local changes**, then saves `server_time` as the next `since` cursor (`sync_meta` table) |

---

## Reports (`/api/v1/reports`)

All need Bearer + `business_id` you own. Dates are `YYYY-MM-DD`.

| Method & path | Query | Response |
|---|---|---|
| GET `/reports/profit-loss` | `business_id, from_date, to_date` | `{period_from, period_to, total_income, total_expense, net_profit, income_by_category{}, expense_by_category{}}` |
| GET `/reports/balance-sheet` | `business_id` | `{business_id, cash, bank, cash_and_bank, stock_value, receivables, payables, owners_capital}` |
| GET `/reports/dashboard-summary` | `business_id, from_date, to_date` | `{period_from, period_to, total_sales, total_invoices, taxable_amount, total_gst, cgst, sgst, igst}` |
| GET `/reports/export/excel` | `business_id, from_date, to_date` | `.xlsx` download `statements_<from>_<to>.xlsx` (P&L + balance sheet) |

Example: `GET /api/v1/reports/dashboard-summary?business_id=1466c377-…&from_date=2026-11-01&to_date=2026-11-30`

```json
{ "period_from": "2026-11-01", "period_to": "2026-11-30", "total_sales": 5900.0, "total_invoices": 3,
  "taxable_amount": 5000.0, "total_gst": 900.0, "cgst": 270.0, "sgst": 270.0, "igst": 360.0 }
```

## Customer ledger (`/api/v1/customers-ledger`)

| Method & path | Query | Response |
|---|---|---|
| GET `/customers-ledger/balances` | `business_id` | `[{ "customer_id": "…", "balance": 1250.0 }]` (highest first) |
| GET `/customers-ledger/{customer_id}/statement` | `business_id`, optional `from_date`, `to_date` | `[{ id, customer_id, invoice_id, payment_id, debit, credit, description, entry_date, running_balance }]` |

## GSTR-1 export records (`/api/v1/gstr1`)

| Method & path | Body / query | Notes |
|---|---|---|
| GET `/gstr1?business_id=…` | — | List of `{id, business_id, period_from, period_to, total_invoices, total_b2b, total_b2c, json_file_path, status, generated_at}` |
| POST `/gstr1?business_id=…` | `{period_from, period_to, total_invoices, total_b2b, total_b2c, json_file_path, status?}` | ⚠️ **Known issue:** the SQL uses `now()`, which SQLite does not have → **500** on the SQLite backend. The phone records exports through sync (`gstr1_exports` entity) instead. |

The GST JSON file itself is produced on the phone — see [SCREENS.md → GST JSON](SCREENS.md#gst-json--gstr-1-export).

---

## Demo (in-memory) routers

> These routers keep data in Python dictionaries with sample data (e.g. business "Apex Enterprise Private Limited", sample products). **Data is lost when the server restarts and is not connected to the phone's synced data.** They require a Bearer token. Useful for API demos in Swagger.

<details>
<summary><b>Business — <code>/business</code></b></summary>

| Method | Path | Notes |
|---|---|---|
| GET | `/business` | Current profile |
| POST | `/business` → 201 | Create/replace profile: `legal_name`, `trade_name?`, `gstin` (15), `pan?` (10), `state_code`, `email`, `phone`, `invoice_prefix` (default `APX-26/`), `is_composition_scheme`, `address{street, city, state, pincode}`, `bank_details?{bank_name, account_number, ifsc_code, branch_name, upi_id?}` |
| PUT | `/business` | Partial update (any of the above) |
| GET | `/business/states` | `[{code, name}]` GST state codes |
| GET | `/business/verify-gstin/{gstin}` | `{gstin, is_valid, state_code, state_name, pan, entity_type}`; **400** `Invalid GSTIN format…` |
</details>

<details>
<summary><b>Products — <code>/products</code></b></summary>

| Method | Path | Notes |
|---|---|---|
| GET | `/products?search=&category=&low_stock_only=false&page=1&page_size=20` | `{items[], total_count, page, page_size}` |
| GET | `/products/{id}` | **404** `Product not found` |
| POST | `/products` → 201 | `name` (≥2), `sku?`, `hsn_code` (2–8), `category`, `unit`, `selling_price` (>0), `purchase_price`, `tax_rate` (default 18), `current_stock`, `min_stock_level`, `is_active` |
| PUT | `/products/{id}` | Partial update |
| DELETE | `/products/{id}` | Soft delete |
| POST | `/products/{id}/stock-adjust` | `{adjustment_type: STOCK_IN\|STOCK_OUT\|DAMAGE\|AUDIT_CORRECTION, quantity_change, reason}`; **400** `Cannot reduce N. Available stock is only M.` |
| GET | `/products/meta/categories` | `["Plumbing", …]` |
</details>

<details>
<summary><b>Invoices — <code>/invoices</code></b></summary>

| Method | Path | Notes |
|---|---|---|
| POST | `/invoices` → 201 | `{customer{name, gstin?, phone?, email?, billing_address, state_code}, items[{product_id?, name, hsn_code, quantity, unit, unit_price, discount_percent, tax_rate}], invoice_date?, due_date?, payment_terms, notes?}` → full invoice with CGST/SGST/IGST per line, totals, round-off, `place_of_supply`, `is_inter_state`. **400** `Insufficient inventory for '…'` |
| GET | `/invoices?status=&search=&date_from=&date_to=` | List |
| GET | `/invoices/{id}` | **404** `Invoice not found` |
| PATCH | `/invoices/{id}/status` | `{status: DRAFT\|ISSUED\|PARTIAL\|PAID\|CANCELLED, notes?}` |
| POST | `/invoices/{id}/cancel?reason=…` | Restocks items; **400** `Invoice is already cancelled.` |
</details>

<details>
<summary><b>Payments — <code>/payments</code></b></summary>

| Method | Path | Notes |
|---|---|---|
| POST | `/payments` → 201 | `{invoice_id?, customer_name, amount (>0), payment_mode: CASH\|UPI\|NEFT_RTGS\|CHEQUE\|CARD, transaction_reference?, payment_date?, notes?}`; **404** invoice not found; **400** `Cannot accept payment for a cancelled invoice.` |
| GET | `/payments?invoice_id=&payment_mode=&customer_name=&date_from=&date_to=` | List |
| GET | `/payments/{id}` | **404** `Payment record not found` |
| GET | `/payments/summary/daily?summary_date=YYYY-MM-DD` | `{date, total_collected, total_transactions, by_mode{}}` |
</details>

<details>
<summary><b>Expenses — <code>/expenses</code></b></summary>

| Method | Path | Notes |
|---|---|---|
| POST | `/expenses` → 201 | `{title, category: RENT\|UTILITIES\|SALARIES\|OFFICE_SUPPLIES\|TRAVEL\|LOGISTICS_FREIGHT\|MAINTENANCE\|RAW_MATERIALS\|TAXES_FEES\|MISCELLANEOUS, amount, vendor_name?, vendor_gstin?, tax_rate, is_itc_eligible, payment_mode: CASH\|UPI\|BANK_TRANSFER\|CARD\|CHEQUE, expense_date?, receipt_reference?, notes?}` |
| GET | `/expenses?category=&is_itc_eligible=&search=&date_from=&date_to=` | List |
| GET / PUT / DELETE | `/expenses/{id}` | **404** `Expense record not found` |
| GET | `/expenses/analytics/summary` | `{total_expenses, total_gst_paid, total_itc_claimable, by_category{}, count}` |
</details>

<details>
<summary><b>Suppliers — <code>/suppliers</code></b></summary>

| Method | Path | Notes |
|---|---|---|
| GET | `/suppliers?search=&has_outstanding=&state_code=` | List |
| GET | `/suppliers/{id}` | **404** `Supplier not found` |
| POST | `/suppliers` → 201 | `{name, contact_person?, gstin?, pan?, state_code (default 27), phone, email?, address?, bank_name?, account_number?, ifsc_code?, outstanding_payable, is_active}` |
| PUT | `/suppliers/{id}` | Partial update |
| DELETE | `/suppliers/{id}` | Deactivate |
| GET | `/suppliers/{id}/bills` | `[{bill_number, bill_date, total_amount, tax_amount, status}]` |
</details>

---

## Common errors

| Status | Body | Meaning / fix |
|---|---|---|
| 401 | `Not authenticated` | No `Authorization: Bearer` header |
| 401 | `Invalid or expired token` | Token expired → call `/auth/refresh` (the app does this automatically) or log in again; also happens if the server's `SECRET_KEY` changed |
| 401 | `Invalid credentials` | Wrong phone/email or password |
| 403 | `You do not own this business` | The business id belongs to another account |
| 404 | `{"detail":"Not Found"}` | Wrong path — usually **missing `/api/v1`** in the base URL |
| 404 | `Business not found` | Server has no such business yet — the phone re-sends it automatically on the next sync |
| 409 | `Phone or email already registered` | Use Login instead |
| 422 | `{"detail":[{"loc":…,"msg":…}]}` | Validation error — read `loc` for the field |
| 500 | — | Server bug; see the uvicorn window for the traceback |

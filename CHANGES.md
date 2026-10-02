# 🚀 Compliance One: Project Guide and Change Log

> 💡 **One-line summary:** A shop billing app that works **with no internet** 📴, then syncs safely to the cloud ☁️ when internet comes back.

A plain-English guide to what this project is, what every folder and file does, what each commit added, and **why**. 🧭

---

## 📑 Table of Contents

1. [🎯 What is this project?](#1--what-is-this-project)
2. [🧠 Key ideas (read this first)](#2--key-ideas-read-this-first)
3. [🔄 How data moves](#3--how-data-moves)
4. [🗺️ Folder map](#4-️-folder-map)
5. [📦 Root files](#5--root-files)
6. [📱 Mobile app](#6--mobile-app-mobile)
7. [🖥️ Backend](#7-️-backend-backend)
8. [🗄️ Database tables and views](#8-️-database-tables-and-views)
9. [📜 Commit history](#9--commit-history)
10. [▶️ How to run everything](#10-️-how-to-run-everything)
11. [📖 Glossary](#11--glossary)
12. [🛠️ Troubleshooting](#12-️-troubleshooting)

---

## 1. 🎯 What is this project?

Compliance One is a business app for small shops. It lets a shop owner:

- 📦 add products and customers
- 🧾 create invoices and record payments
- 💸 record expenses
- 📊 see who owes money, profit and loss, and a balance sheet

**🔥 The main problem it solves:** shops often have bad or no internet. The app must work **offline**, then upload everything safely when internet returns. This is called **offline-first**.

| Part | 📁 Folder | 🧰 Tech | 🎭 Role |
| :--- | :--- | :--- | :--- |
| 📱 Phone app | `mobile/` | React Native (Expo) + SQLite | Works offline. Saves data on the phone. |
| ☁️ Server | `backend/` | FastAPI + PostgreSQL | Keeps the final copy of all data in the cloud. |

---

## 2. 🧠 Key ideas (read this first)

| # | Idea | 💬 Simple meaning |
| :-: | :--- | :--- |
| 1 | 📴 **Offline-first** | The phone saves first. The user never waits for internet. |
| 2 | 📮 **Outbox queue** | Every change is also written as a note in `sync_outbox`: a mailbox of changes waiting to be sent. |
| 3 | 🔁 **Sync** | When internet returns, notes are sent to the server. Only after the server confirms are they marked done. |
| 4 | ♻️ **Idempotent** | Sending the same note twice does not create duplicates. Same result as sending once. |
| 5 | 🧮 **Computed balances** | We never store "customer owes 500". We store every transaction and add them up when needed. |

```text
❌ BAD  (stored):    customers.balance = 500          <- can go wrong after a sync problem
✅ GOOD (computed):  balance = SUM(credit) - SUM(debit)   <- always matches the records
```

> ✨ If the records are right, the total is always right.

---

## 3. 🔄 How data moves

```text
 📱 PHONE (works offline)                             ☁️ CLOUD
 ------------------------                             --------
 1. 🧾 User creates invoice
        |
        v
 2. 💾 Saved in local SQLite
    + 📮 note added to sync_outbox (status: pending)
        |
        v
 3. 📡 netListener detects internet is back
        |
        v
 4. 🚚 syncManager reads pending notes (a batch)
        |
        v
 5. 🌐 client.ts sends: POST /api/v1/sync/push -----> 6. 🚪 api/v1/sync.py receives it
                                                              |
                                                              v
                                                       7. 🧠 sync_reconciler.py
                                                          for each note:
                                                            exists? -> ✏️ UPDATE
                                                            new?    -> ➕ INSERT
                                                            error?  -> ⚠️ skip, report as failed
                                                              |
                                                              v
                                                       8. 🗄️ Saved in PostgreSQL
        ^                                                     |
        |                                                     |
 9. ✅ Phone gets { processed_ids, failed_ids } <-------------+
        |
        v
10. 🏁 Processed notes marked "synced". Failed ones stay for retry.
```

> 🛡️ One bad note does **not** stop the batch. Good notes are saved. Bad ones are reported back.

---

## 4. 🗺️ Folder map

```text
📂 Compilance_One-Application/
├── 🚫 .gitignore
├── 🐳 docker-compose.yml
├── 📘 CHANGES.md
│
├── 📱 mobile/                          Phone app
│   ├── 🚫 .gitignore
│   ├── 📦 package.json
│   ├── ⚙️ tsconfig.json
│   └── 📂 src/
│       ├── 📂 api/
│       │   └── 🌐 client.ts
│       ├── 📂 db/
│       │   ├── 🗃️ schema.ts
│       │   └── 📂 views/
│       │       ├── 👥 customerBalances.ts
│       │       ├── 📈 profitLoss.ts
│       │       └── ⚖️ balanceSheet.ts
│       └── 📂 sync/
│           ├── 📡 netListener.ts
│           ├── 📮 outbox.ts
│           └── 🚚 syncManager.ts
│
└── 🖥️ backend/                         Server
    ├── 🐳 Dockerfile
    ├── 📦 requirements.txt
    ├── ⚙️ alembic.ini
    ├── 📂 alembic/
    │   ├── 🏃 env.py
    │   └── 📂 versions/
    │       └── 🧱 <hash>_create_core_tables.py
    ├── 📂 tests/
    │   ├── 🐍 __init__.py
    │   └── 🧪 test_sync_reconciler.py
    └── 📂 app/
        ├── 🐍 __init__.py
        ├── 🚪 main.py
        ├── 📂 db/
        │   ├── 🐍 __init__.py
        │   ├── 🔌 session.py
        │   └── 👁️ views.sql
        ├── 📂 models/
        │   ├── 🐍 __init__.py
        │   └── 🧬 entities.py
        ├── 📂 schemas/
        │   ├── 🐍 __init__.py
        │   └── 🛂 sync.py
        ├── 📂 services/
        │   ├── 🐍 __init__.py
        │   └── 🧠 sync_reconciler.py
        └── 📂 api/
            ├── 🐍 __init__.py
            └── 📂 v1/
                ├── 🐍 __init__.py
                └── 🌐 sync.py
```

---

## 5. 📦 Root files

| 📄 File | 🔧 What it does | 💭 Why it exists |
| :--- | :--- | :--- |
| 🚫 `.gitignore` | Lists files git must not track: `.venv`, `node_modules`, `__pycache__`, `.pytest_cache`, secrets. | Keeps the repo small and prevents leaking passwords. |
| 🐳 `docker-compose.yml` | Starts `db` (PostgreSQL 16 on port 5432, saved disk volume) and `backend` (FastAPI). | One command starts the whole backend. |
| 📘 `CHANGES.md` | This guide. | So anyone can understand the project quickly. |

---

## 6. 📱 Mobile app (`mobile/`)

Uses `expo-sqlite` with plain SQL. No heavy ORM, so queries are fast and predictable. ⚡

### ⚙️ Config files

| 📄 File | 🔧 What it does |
| :--- | :--- |
| 📦 `package.json` | Libraries: `expo`, `expo-sqlite` (local database), `@react-native-community/netinfo` (internet detection). |
| ⚙️ `tsconfig.json` | TypeScript settings. Catches type mistakes before the app runs. |
| 🚫 `.gitignore` | Ignores mobile `node_modules` and build files. |

### 🗃️ `src/db/schema.ts` : the local database
Creates SQLite tables at app start: `products`, `customers`, `invoices`, `invoice_items`, `payments`, `ledger_entries`, `expenses`, `sync_outbox`.
**💭 Why:** the phone needs its own full database to work offline.

### 📡 `src/sync/netListener.ts` : the internet watcher
Watches the connection. When it changes from offline to online, it triggers a sync.
**💭 Why:** the user should never have to press a "sync" button.

### 📮 `src/sync/outbox.ts` : the mailbox
Adds a note to `sync_outbox` whenever data is created, changed, or deleted.

| 🏷️ Field | 💬 Meaning |
| :--- | :--- |
| `id` | Outbox note number |
| `entity` | Which table changed (for example `invoices`) |
| `entity_id` | UUID of the changed row |
| `operation` | `INSERT`, `UPDATE`, or `DELETE` |
| `payload` | The row data as JSON |
| `status` | 🟡 `pending`, 🟢 `synced`, or 🔴 `failed` |
| `retry_count` | How many times sending was tried |

**💭 Why:** records exactly what must be uploaded, so nothing is lost.

### 🚚 `src/sync/syncManager.ts` : the courier
1. 📥 Reads a batch of `pending` notes.
2. 📤 Sends them using `client.ts`.
3. ✅ For IDs the server confirms, marks them `synced`.
4. ❌ For IDs that failed, marks them `failed` and adds 1 to `retry_count`.

**💭 Why:** a note leaves the queue only after the server confirms. If the app crashes mid-sync, nothing is lost.

### 🌐 `src/api/client.ts` : the HTTP messenger
Has `postSyncBatch(items)`, which sends the batch to `POST /api/v1/sync/push`.
**💭 Why:** all network code lives in one place. Changing the server address or adding auth later is easy.

### 👁️ `src/db/views/` : live calculations
Run SQL on raw rows each time. No totals are saved.

| 📄 File | 🧮 What it calculates | 📐 Formula |
| :--- | :--- | :--- |
| 👥 `customerBalances.ts` | How much each customer owes, plus a running statement. | `SUM(credit) - SUM(debit)` per customer. Statement uses window function `SUM(...) OVER (...)`. |
| 📈 `profitLoss.ts` | Profit. | `Net Profit = Total Revenue (invoices) - Total Expenses` |
| ⚖️ `balanceSheet.ts` | Assets. | `Total Assets = Customer Receivables + Inventory Value` |

**💭 Why:** these work offline and can never be out of date.

---

## 7. 🖥️ Backend (`backend/`)

Built with FastAPI and SQLAlchemy 2.0 in **async** mode (handles many requests without waiting). ⚡

### 🧰 Setup files

| 📄 File | 🔧 What it does |
| :--- | :--- |
| 🐳 `Dockerfile` | Recipe to build the backend container image. |
| 📦 `requirements.txt` | Python libraries: FastAPI, SQLAlchemy, asyncpg, alembic, pytest, others. |
| ⚙️ `alembic.ini` | Settings for Alembic (database migration tool). |

### 🚪 `app/main.py` : the front door
- 🏗️ Creates the FastAPI app.
- 🔓 Enables **CORS** so the mobile app can call the server.
- ❤️ Adds the `/health` check.
- 🔗 Connects the `/api/v1` routes.

Health check: `GET /health` returns `{"status":"ok","service":"compliance-one-gateway"}`.

### 🔌 `app/db/session.py` : database connection
- Creates the async engine (`create_async_engine`) with the `asyncpg` driver.
- Defines the `DeclarativeBase` all models use.
- Provides `get_db_session()`, giving each request its own session via `Depends(...)`.

### 🧬 `app/models/entities.py` : the table blueprints
One SQLAlchemy model per table, matching the ER diagram 1:1:

`Business`, `Product`, `Customer`, `Invoice`, `InvoiceItem`, `Payment`, `LedgerEntry`, `Expense`

Includes foreign keys with cascades, check rules (for example `payment_status` must be `PAID`, `UNPAID`, or `PARTIAL`), and UTC timestamps.
**💭 Why:** the database rejects invalid data even if app code has a bug.

### 👁️ `app/db/views.sql` : calculated views in PostgreSQL

| 👁️ View | 💬 Meaning |
| :--- | :--- |
| `v_customer_balances` | Totals per customer from the ledger. |
| `v_profit_loss` | Taxable invoice revenue compared with expenses. |
| `v_balance_sheet` | Receivables plus stock (`quantity × price`). |

**💭 Why:** the server gives the same answers as the phone, using the same "compute, don't store" rule.

### 🛂 `app/schemas/sync.py` : data checking
Pydantic models that validate incoming JSON.

- 📨 `SyncItemIn`: one change note (outbox ID, table name, entity UUID, operation, payload).
- 📬 `SyncPushResponse`: reply with `processed_ids` and `failed_ids`.

**💭 Why:** bad data is rejected at the door, before it touches the database.

### 🧠 `app/services/sync_reconciler.py` : the sync brain
For each note in a batch:
- ➕ Record does not exist: **insert**.
- ✏️ Record exists: **update** (an "upsert").
- 🛡️ Each note runs in its own protected step. A failure **rolls back only that note** and its ID goes into `failed_ids`.

**💭 Why:** safe retries, no duplicates, and one bad record never blocks the others.

### 🌐 `app/api/v1/sync.py` : the route
Exposes `POST /api/v1/sync/push` and passes the request to `SyncReconciler`.
**💭 Why:** keeps the HTTP layer thin. Real logic lives in the service, which is easier to test.

### 🧱 `alembic/` : database version control

| 📄 File | 🔧 What it does |
| :--- | :--- |
| 🏃 `env.py` | Async migration runner. Reads `DATABASE_URL` and compares models to the real database. |
| 🧱 `versions/<hash>_create_core_tables.py` | First migration. Creates all 8 tables, then installs the 3 views from `views.sql`. |

**💭 Why:** database structure is tracked like code. `alembic upgrade head` rebuilds it on any machine.

### 🧪 `tests/test_sync_reconciler.py` : automatic checks
Runs on in-memory SQLite (`sqlite+aiosqlite:///:memory:`): fast, no Postgres needed. Tests:

1. ✅ Batch **insert** works.
2. ♻️ Sending the same item again **updates**, with no duplicate.
3. ⚠️ An invalid item **fails alone** and the rest succeed.

### 🐍 `__init__.py` files
Empty files telling Python "this folder is a package". Without them, imports can fail.

---

## 8. 🗄️ Database tables and views

### 📋 Tables (8)

| 🗂️ Table | 💬 Stores |
| :--- | :--- |
| 🏪 `businesses` | The shop or company. |
| 📦 `products` | Items sold, with price and stock. |
| 👥 `customers` | People who buy. |
| 🧾 `invoices` | A sale. Has `payment_status`. |
| 📃 `invoice_items` | Product lines inside an invoice. |
| 💰 `payments` | Money received. |
| 📒 `ledger_entries` | Credit and debit records. Source for balances. |
| 💸 `expenses` | Business costs. |

### 👁️ Views (3)

`v_customer_balances`, `v_profit_loss`, `v_balance_sheet` (see section 7).

---

## 9. 📜 Commit history

🌿 Branch: `feat/core-infra-sync`

| # | 💬 Commit message | 🛠️ What was done | 🌟 Why it mattered |
| :-: | :--- | :--- | :--- |
| 1️⃣ | `feat(mobile): initialize sync outbox schema and network listener` | Added `sync_outbox` table and `netListener.ts`. | Foundation of offline-first: remember changes and detect internet. |
| 2️⃣ | `feat(mobile): implement api rest client and sync manager pipeline` | Added `client.ts` and `syncManager.ts`. | The phone can now send queued changes. |
| 3️⃣ | `feat(mobile): implement offline computed views for ledger, p&l, and balance sheet` | Added `customerBalances.ts`, `profitLoss.ts`, `balanceSheet.ts`. | Reports work offline and are never stale. |
| 4️⃣ | `feat(backend): configure docker-compose, fast-api entrypoint, and async db session` | Added `docker-compose.yml`, `Dockerfile`, `main.py`, `session.py`. | A running server with a database connection. |
| 5️⃣ | `feat(backend): implement sqlalchemy 2.0 orm models and postgres views` | Added `entities.py` and `views.sql`. | Server database structure matches the design. |
| 6️⃣ | `feat(backend): implement sync reconciler service and batch push endpoint` | Added `schemas/sync.py`, `sync_reconciler.py`, `api/v1/sync.py`. | Server can receive and safely store phone changes. |
| 7️⃣ | `test(backend): add pytest integration suite for sync reconciler pipeline` | Added `test_sync_reconciler.py`. | Proves insert, update, and failure isolation work. |
| 8️⃣ | `feat(backend): configure async alembic migrations and run core schema with views` | Set up Alembic and the first migration. | One command builds all 8 tables and 3 views in PostgreSQL. |
| 9️⃣ | `chore: add package markers and update mobile sync client` | Added missing `__init__.py` files, cleaned leftover changes. | Clean imports and a clean git tree. |

### 🏗️ Build order at a glance

```text
📱 Phone:   [1 📮 Outbox] -> [2 🚚 Sync + API client] -> [3 📊 Offline reports]
🖥️ Server:  [4 🐳 Docker + API] -> [5 🧬 Models + Views] -> [6 🧠 Sync engine] -> [7 🧪 Tests] -> [8 🧱 Migrations]
🧹 Cleanup: [9 🐍 Markers + tidy]
```

---

## 10. ▶️ How to run everything

Run from the project root unless noted. 👇

### 🐘 Step 1: Start PostgreSQL

```bash
podman run -d \
  --name compliance_one_postgres \
  -e POSTGRES_USER=dev_user \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=compliance_one_db \
  -p 5432:5432 \
  postgres:16-alpine
```

Check it is running:

```bash
podman ps
```

### 🧱 Step 2: Create tables and views

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
```

### 🧪 Step 3: Run the tests

```bash
PYTHONPATH=. pytest tests/test_sync_reconciler.py -v
```

✅ Expected: all tests pass.

### 🚀 Step 4: Start the server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### ❤️ Step 5: Check health

```bash
curl http://localhost:8000/health
```

✅ Expected: `{"status":"ok","service":"compliance-one-gateway"}`

### 📱 Step 6: Check mobile types

```bash
cd ../mobile
npx tsc --noEmit
```

✅ Expected: no errors.

---

## 11. 📖 Glossary

| 🔤 Word | 💬 Simple meaning |
| :--- | :--- |
| 📴 Offline-first | The app works with no internet and syncs later. |
| 📮 Outbox | A queue of changes waiting to upload. |
| 🔁 Sync | Sending local changes to the server. |
| ♻️ Idempotent | Doing it twice gives the same result as once. |
| 🔀 Upsert | Update if it exists, insert if it does not. |
| ↩️ Rollback | Undo a failed change so nothing is half-saved. |
| 📒 Ledger | A list of every money movement (credit and debit). |
| 👁️ View | A saved query that shows calculated results. |
| 🧱 Migration | A script that changes the database structure safely. |
| 🧬 ORM | Python classes that represent database tables. |
| 🔓 CORS | A rule that decides which apps may call the server. |
| ⚡ Async | The server can work on many requests without blocking. |

---

## 12. 🛠️ Troubleshooting

| 🚨 Problem | 🔍 Likely cause | 🩹 Fix |
| :--- | :--- | :--- |
| `alembic upgrade head` cannot connect | PostgreSQL not running or `DATABASE_URL` wrong. | Run `podman ps`, then check credentials in Step 1. |
| `ModuleNotFoundError: app` | Missing `PYTHONPATH=.` | Run from `backend/` with `PYTHONPATH=.` |
| Port 5432 already in use | Another Postgres is running. | Stop it, or change the port mapping. |
| Tests fail on import | Missing `__init__.py` | Ensure every folder under `backend/app` and `backend/tests` has one. |
| `tsc` shows type errors | Missing packages or wrong types. | Run `npm install` in `mobile/`, then retry. |
| Items stay `pending` forever | No internet, or server unreachable. | Check the API URL in `client.ts` and that the server is running. |

---

> 🎉 **You made it to the end!** Now you know what every folder, file, and commit does, and why. Happy building! 💪# Compliance One: Project Guide and Change Log

A plain-English guide to what this project is, what every folder and file does, what each commit added, and why.

---

## Table of Contents

1. [What is this project?](#1-what-is-this-project)
2. [Key ideas (read this first)](#2-key-ideas-read-this-first)
3. [How data moves](#3-how-data-moves)
4. [Folder map](#4-folder-map)
5. [Root files](#5-root-files)
6. [Mobile app, file by file](#6-mobile-app-mobile)
7. [Backend, file by file](#7-backend-backend)
8. [Database tables and views](#8-database-tables-and-views)
9. [Commit history: what each commit did and why](#9-commit-history)
10. [How to run everything](#10-how-to-run-everything)
11. [Glossary](#11-glossary)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What is this project?

Compliance One is a business app for small shops. It lets a shop owner:

- add products and customers
- create invoices and record payments
- record expenses
- see who owes money, profit and loss, and a balance sheet

**The main problem it solves:** shops often have bad or no internet. The app must work with **no internet at all**, then upload everything safely when internet comes back.

This is called **offline-first**.

The project has two parts:

| Part | Folder | Tech | Role |
| :--- | :--- | :--- | :--- |
| Phone app | `mobile/` | React Native (Expo) + SQLite | Works offline. Saves data on the phone. |
| Server | `backend/` | FastAPI + PostgreSQL | Stores the final copy of all data in the cloud. |

---

## 2. Key ideas (read this first)

### Idea 1: Offline-first
The phone is the first place data is saved. The user never waits for the internet.

### Idea 2: Outbox queue
Every change made offline (new invoice, edited customer) is also written as a small note in a table called `sync_outbox`. Think of it as a **mailbox of changes waiting to be sent**.

### Idea 3: Sync
When internet returns, the app takes notes from the outbox and sends them to the server. The server confirms. Only then does the phone mark them as done.

### Idea 4: Idempotent (safe to repeat)
If the same note is sent twice (for example, the network dropped before the phone got the reply), the server must not create duplicates. Sending the same thing twice gives the same result as sending it once.

### Idea 5: Computed balances (no stored totals)
We never store "customer owes 500". We store every transaction (the ledger) and **add them up when needed**.

```text
BAD  (stored):    customers.balance = 500      <- can go wrong after a sync problem
GOOD (computed):  balance = SUM(credit) - SUM(debit)   <- always matches the records
```

If the records are right, the total is always right.

---

## 3. How data moves

```text
 PHONE (works offline)                               CLOUD
 ---------------------                               -----
 1. User creates invoice
        |
        v
 2. Saved in local SQLite
    + a note added to sync_outbox (status: pending)
        |
        v
 3. netListener detects internet is back
        |
        v
 4. syncManager reads pending notes (a batch)
        |
        v
 5. client.ts sends:  POST /api/v1/sync/push  ------>  6. api/v1/sync.py receives it
                                                              |
                                                              v
                                                       7. sync_reconciler.py
                                                          for each note:
                                                            exists?  -> UPDATE
                                                            new?     -> INSERT
                                                            error?   -> skip, report as failed
                                                              |
                                                              v
                                                       8. Saved in PostgreSQL
        ^                                                     |
        |                                                     |
 9. Phone gets { processed_ids, failed_ids } <----------------+
        |
        v
10. Processed notes marked "synced". Failed ones stay for retry.
```

Important: one bad note does **not** stop the whole batch. Good notes are saved. Bad ones are reported back.

---

## 4. Folder map

```text
Compilance_One-Application/
├── .gitignore
├── docker-compose.yml
├── CHANGES.md
│
├── mobile/                          Phone app
│   ├── .gitignore
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── api/
│       │   └── client.ts
│       ├── db/
│       │   ├── schema.ts
│       │   └── views/
│       │       ├── customerBalances.ts
│       │       ├── profitLoss.ts
│       │       └── balanceSheet.ts
│       └── sync/
│           ├── netListener.ts
│           ├── outbox.ts
│           └── syncManager.ts
│
└── backend/                         Server
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic.ini
    ├── alembic/
    │   ├── env.py
    │   └── versions/
    │       └── <hash>_create_core_tables.py
    ├── tests/
    │   ├── __init__.py
    │   └── test_sync_reconciler.py
    └── app/
        ├── __init__.py
        ├── main.py
        ├── db/
        │   ├── __init__.py
        │   ├── session.py
        │   └── views.sql
        ├── models/
        │   ├── __init__.py
        │   └── entities.py
        ├── schemas/
        │   ├── __init__.py
        │   └── sync.py
        ├── services/
        │   ├── __init__.py
        │   └── sync_reconciler.py
        └── api/
            ├── __init__.py
            └── v1/
                ├── __init__.py
                └── sync.py
```

---

## 5. Root files

| File | What it does | Why it exists |
| :--- | :--- | :--- |
| `.gitignore` | Lists files git must not track: `.venv`, `node_modules`, `__pycache__`, `.pytest_cache`, secrets. | Keeps the repo small and prevents leaking passwords. |
| `docker-compose.yml` | Starts two services together: `db` (PostgreSQL 16 on port 5432, with saved disk volume) and `backend` (the FastAPI server). | One command starts the whole backend instead of many manual steps. |
| `CHANGES.md` | This guide. | So anyone can understand the project quickly. |

---

## 6. Mobile app (`mobile/`)

The mobile app uses `expo-sqlite` with plain SQL. There is no heavy ORM, so queries are fast and easy to predict.

### Config files

| File | What it does |
| :--- | :--- |
| `package.json` | Lists libraries: `expo`, `expo-sqlite` (local database), `@react-native-community/netinfo` (internet detection). |
| `tsconfig.json` | TypeScript settings. Catches type mistakes before the app runs. |
| `.gitignore` | Ignores mobile `node_modules` and build files. |

### `src/db/schema.ts`: the local database
Creates the SQLite tables when the app starts: `products`, `customers`, `invoices`, `invoice_items`, `payments`, `ledger_entries`, `expenses`, and `sync_outbox`.
**Why:** the phone needs its own full database to work offline.

### `src/sync/netListener.ts`: the internet watcher
Watches the connection. When it changes from offline to online, it triggers a sync.
**Why:** the user should never have to press a "sync" button.

### `src/sync/outbox.ts`: the mailbox
Helper functions that add a note to `sync_outbox` whenever data is created, changed, or deleted. Each note has:

| Field | Meaning |
| :--- | :--- |
| `id` | Outbox note number |
| `entity` | Which table changed (for example `invoices`) |
| `entity_id` | UUID of the changed row |
| `operation` | `INSERT`, `UPDATE`, or `DELETE` |
| `payload` | The row data as JSON |
| `status` | `pending`, `synced`, or `failed` |
| `retry_count` | How many times sending was tried |

**Why:** it records exactly what must be uploaded, so nothing is lost.

### `src/sync/syncManager.ts`: the courier
1. Reads a batch of `pending` notes.
2. Sends them using `client.ts`.
3. For IDs the server confirms, marks them `synced`.
4. For IDs that failed, marks them `failed` and adds 1 to `retry_count`.

**Why:** a note is removed from the queue only after the server confirms it. If the app crashes mid-sync, nothing is lost.

### `src/api/client.ts`: the HTTP messenger
Has `postSyncBatch(items)`, which sends the batch to `POST /api/v1/sync/push`.
**Why:** all network code lives in one place, so changing the server address or adding auth later is easy.

### `src/db/views/`: live calculations
These files run SQL on the raw rows each time. No totals are saved.

| File | What it calculates | Formula |
| :--- | :--- | :--- |
| `customerBalances.ts` | How much each customer owes, plus a running statement. | `SUM(credit) - SUM(debit)` per customer. The statement uses a SQLite window function `SUM(...) OVER (...)`. |
| `profitLoss.ts` | Profit. | `Net Profit = Total Revenue (invoices) - Total Expenses` |
| `balanceSheet.ts` | Assets. | `Total Assets = Customer Receivables + Inventory Value` |

**Why:** these work offline and can never be out of date.

---

## 7. Backend (`backend/`)

Built with FastAPI and SQLAlchemy 2.0 in **async** mode (the server can handle many requests at once without waiting).

### Setup files

| File | What it does |
| :--- | :--- |
| `Dockerfile` | Recipe to build the backend container image. |
| `requirements.txt` | Python libraries: FastAPI, SQLAlchemy, asyncpg, alembic, pytest, and others. |
| `alembic.ini` | Settings for Alembic (the database migration tool). |

### `app/main.py`: the front door
- Creates the FastAPI app.
- Enables **CORS** so the mobile app is allowed to call the server.
- Adds the `/health` check.
- Connects the `/api/v1` routes.

Health check: `GET /health` returns `{"status":"ok","service":"compliance-one-gateway"}`.

### `app/db/session.py`: database connection
- Creates the async engine (`create_async_engine`) using the `asyncpg` driver.
- Defines the `DeclarativeBase` that all models use.
- Provides `get_db_session()`, which gives each request its own database session through FastAPI's `Depends(...)`.

### `app/models/entities.py`: the table blueprints
SQLAlchemy models, one per table, matching the ER diagram 1:1:

`Business`, `Product`, `Customer`, `Invoice`, `InvoiceItem`, `Payment`, `LedgerEntry`, `Expense`

Also includes foreign keys with cascades, check rules (for example `payment_status` must be `PAID`, `UNPAID`, or `PARTIAL`), and UTC timestamps.
**Why:** the database itself rejects invalid data, even if app code has a bug.

### `app/db/views.sql`: calculated views in PostgreSQL

| View | Meaning |
| :--- | :--- |
| `v_customer_balances` | Totals per customer from the ledger. |
| `v_profit_loss` | Taxable invoice revenue compared with expenses. |
| `v_balance_sheet` | Receivables plus stock (`quantity × price`). |

**Why:** the server gives the same answers as the phone, using the same "compute, don't store" rule.

### `app/schemas/sync.py`: data checking
Pydantic models that validate incoming JSON.

- `SyncItemIn`: one change note (outbox ID, table name, entity UUID, operation, payload).
- `SyncPushResponse`: reply with `processed_ids` and `failed_ids`.

**Why:** bad data is rejected at the door, before it touches the database.

### `app/services/sync_reconciler.py`: the sync brain
For each note in a batch:
- If the record does not exist: **insert**.
- If it exists: **update** (an "upsert").
- Each note runs in its own protected step, so a failure **rolls back only that note**. The ID is reported in `failed_ids`.

**Why:** safe retries, no duplicates, and one bad record never blocks the others.

### `app/api/v1/sync.py`: the route
Exposes `POST /api/v1/sync/push` and passes the request to `SyncReconciler`.
**Why:** keeps the HTTP layer thin. The real logic is in the service, which is easier to test.

### `alembic/`: database version control

| File | What it does |
| :--- | :--- |
| `env.py` | Async migration runner. Reads `DATABASE_URL` and compares models to the real database. |
| `versions/<hash>_create_core_tables.py` | First migration. Creates all 8 tables, then installs the 3 views from `views.sql`. |

**Why:** the database structure is tracked like code. `alembic upgrade head` rebuilds it on any machine.

### `tests/test_sync_reconciler.py`: automatic checks
Runs against in-memory SQLite (`sqlite+aiosqlite:///:memory:`), so it is fast and needs no Postgres. It tests:

1. Batch **insert** works.
2. Sending the same item again **updates** and does not duplicate.
3. An invalid item **fails alone** and the rest still succeed.

### `__init__.py` files
Empty files that tell Python "this folder is a package". Without them, imports can fail.

---

## 8. Database tables and views

### Tables (8)

| Table | Stores |
| :--- | :--- |
| `businesses` | The shop or company. |
| `products` | Items sold, with price and stock. |
| `customers` | People who buy. |
| `invoices` | A sale. Has `payment_status`. |
| `invoice_items` | Product lines inside an invoice. |
| `payments` | Money received. |
| `ledger_entries` | Credit and debit records. This is the source for balances. |
| `expenses` | Business costs. |

### Views (3)

`v_customer_balances`, `v_profit_loss`, `v_balance_sheet` (see section 7).

---

## 9. Commit history

Branch: `feat/core-infra-sync`

| # | Commit message | What was done | Why it mattered |
| :-: | :--- | :--- | :--- |
| 1 | `feat(mobile): initialize sync outbox schema and network listener` | Added the `sync_outbox` table and `netListener.ts`. | Foundation of offline-first: remember changes and detect internet. |
| 2 | `feat(mobile): implement api rest client and sync manager pipeline` | Added `client.ts` and `syncManager.ts`. | The phone can now actually send queued changes. |
| 3 | `feat(mobile): implement offline computed views for ledger, p&l, and balance sheet` | Added `customerBalances.ts`, `profitLoss.ts`, `balanceSheet.ts`. | Reports work offline and are never stale. |
| 4 | `feat(backend): configure docker-compose, fast-api entrypoint, and async db session` | Added `docker-compose.yml`, `Dockerfile`, `main.py`, `session.py`. | A running server with a database connection. |
| 5 | `feat(backend): implement sqlalchemy 2.0 orm models and postgres views` | Added `entities.py` and `views.sql`. | Server database structure now matches the design. |
| 6 | `feat(backend): implement sync reconciler service and batch push endpoint` | Added `schemas/sync.py`, `sync_reconciler.py`, `api/v1/sync.py`. | The server can now receive and safely store phone changes. |
| 7 | `test(backend): add pytest integration suite for sync reconciler pipeline` | Added `test_sync_reconciler.py`. | Proves insert, update, and failure isolation work. |
| 8 | `feat(backend): configure async alembic migrations and run core schema with views` | Set up Alembic and the first migration. | One command builds all 8 tables and 3 views in PostgreSQL. |
| 9 | `chore: add package markers and update mobile sync client` | Added missing `__init__.py` files, cleaned up leftover changes. | Clean imports and a clean git tree. |

### Build order at a glance

```text
Phone side:   [1 Outbox] -> [2 Sync + API client] -> [3 Offline reports]
Server side:  [4 Docker + API] -> [5 Models + Views] -> [6 Sync engine] -> [7 Tests] -> [8 Migrations]
Cleanup:      [9 Markers + tidy]
```

---

## 10. How to run everything

Run these from the project root unless noted.

### Step 1: Start PostgreSQL

```bash
podman run -d \
  --name compliance_one_postgres \
  -e POSTGRES_USER=dev_user \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=compliance_one_db \
  -p 5432:5432 \
  postgres:16-alpine
```

Check it is running:

```bash
podman ps
```

### Step 2: Create tables and views

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. alembic upgrade head
```

### Step 3: Run the tests

```bash
PYTHONPATH=. pytest tests/test_sync_reconciler.py -v
```

Expected: all tests pass.

### Step 4: Start the server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 5: Check health

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok","service":"compliance-one-gateway"}`

### Step 6: Check mobile types

```bash
cd ../mobile
npx tsc --noEmit
```

Expected: no errors.

---

## 11. Glossary

| Word | Simple meaning |
| :--- | :--- |
| Offline-first | The app works with no internet and syncs later. |
| Outbox | A queue of changes waiting to upload. |
| Sync | Sending local changes to the server. |
| Idempotent | Doing it twice gives the same result as once. |
| Upsert | Update if it exists, insert if it does not. |
| Rollback | Undo a failed change so nothing is half-saved. |
| Ledger | A list of every money movement (credit and debit). |
| View | A saved query that shows calculated results. |
| Migration | A script that changes the database structure safely. |
| ORM | Python classes that represent database tables. |
| CORS | A browser rule that decides which apps may call the server. |
| Async | The server can work on many requests without blocking. |

---

## 12. Troubleshooting

| Problem | Likely cause | Fix |
| :--- | :--- | :--- |
| `alembic upgrade head` cannot connect | PostgreSQL is not running or `DATABASE_URL` is wrong. | Run `podman ps`, then check the credentials in Step 1. |
| `ModuleNotFoundError: app` | Missing `PYTHONPATH=.` | Run commands from `backend/` with `PYTHONPATH=.` |
| Port 5432 already in use | Another Postgres is running. | Stop it, or change the port mapping. |
| Tests fail on import | Missing `__init__.py` | Make sure every folder under `backend/app` and `backend/tests` has one. |
| `tsc` shows type errors | Missing packages or wrong types. | Run `npm install` in `mobile/`, then retry. |
| Items stay `pending` forever | No internet, or server unreachable. | Check the API URL in `client.ts` and that the server is running. |

# Compilance_One-Application

Compliance One Offline, voice-powered GST invoicing for small businesses. Uses NLP to turn spoken orders into compliant tax invoices, with Bluetooth printing, digital sharing, expense/P&amp;L tracking, and one-tap GSTR-1 export — all without internet dependency

---
## GST Voice Billing App — Tech Stack & Folder Structure
 
Derived directly from your architecture diagram and the Neon/Postgres schema — not a generic stack, so a few choices below follow decisions the diagram already made.
 
## Architecture framing
 
- **The backend isn't on the critical path.** Voice parsing, invoice math, ledger/P&L/balance sheet, and GSTR-1 JSON all run on-device against local SQLite. The backend exists for backup, multi-device sync, and audit — exactly what the diagram's own header comment says.
- **NLU parsing is client-side TypeScript, not backend Python.** `VBa` reads the cached product master straight off `LOCALDB` and takes input from both STT paths — so numeral parsing and fuzzy product matching have to be hand-rolled in the mobile app; your FastAPI/Python NLP tooling never sees the raw transcript at parse time.
- **Balances are always computed, never cached.** `LOCALVIEW` and the three Postgres views (`VBAL`/`VPL`/`VBS`) recompute `customer_balances`, P&L, and the balance sheet from raw rows every time — the same sync-safety fix your schema doc made for `ledger_entries.balance`, now extended to all three statements. Local and server SQL need to stay in lockstep.
- **Backend `SVC*` nodes are routers in one FastAPI app, not microservices.** Right-sized for a solo build — no orchestration layer needed.
## Tech stack
 
| Category | Component | Technology | Maps to / why |
|---|---|---|---|
| Mobile | Framework | React Native, Expo **Dev Client** build (not Expo Go) | Bluetooth ESC/POS + native speech recognition need custom native modules Expo Go can't load |
| Mobile | Local DB | SQLite via `expo-sqlite` | `LOCALDB` |
| Mobile | Local query layer | `drizzle-orm` (or raw SQL) over `expo-sqlite` | `LOCALVIEW` — mirrors the Postgres views |
| Mobile | State | Zustand | session, active business, offline banner |
| Mobile | Fuzzy product match | `fuse.js` | `VBa` — matches spoken item to product master |
| Voice | On-device STT | Android `SpeechRecognizer` (`EXTRA_PREFER_OFFLINE`) via `@react-native-voice/voice` or equivalent | `VBp2` on-device path |
| Voice | Cloud STT fallback | Google Cloud Speech-to-Text or Azure Speech, `ta-IN` locale | `VBp2` cloud path → `CLOUDSTT` |
| Voice | NLU parser | Custom rule-based: tokenizer + Tamil-numeral lexicon + `fuse.js` matching; confidence = % tokens resolved | `VBa` → `VBo` |
| Printing | ESC/POS | `react-native-thermal-receipt-printer` (or similar current Bluetooth ESC/POS lib — check maintenance status) | `PRINTp` → `PRINTER` |
| Sync | Engine | Custom outbox/inbox queue + `@react-native-community/netinfo` for reconnect triggers | `SYNCMGR` |
| Backend | Framework | FastAPI | `GATEWAY` + all `SVC*` |
| Backend | ORM / migrations | SQLAlchemy 2.0 + Alembic | 1:1 with the ER diagram |
| Backend | Validation | Pydantic v2 schemas | request/response |
| Backend | Auth | JWT (`python-jose`) + `passlib[bcrypt]`, session scoped per business | `GATEWAY` |
| Backend | Excel export | `openpyxl` | GSTR-1 "export as Excel" |
| Data | Primary DB | PostgreSQL on Neon (serverless) | `DB` — already decided in your schema doc |
| Data | Views | `customer_balances`, P&L, balance sheet as `CREATE VIEW`, no stored column | `VBAL` / `VPL` / `VBS` |
| Infra | Backend hosting | Render / Railway / Fly.io, single container | proportional to a solo prototype |
| Infra | Local dev | Docker + `docker-compose` (backend + local Postgres) | |
| Infra | CI | GitHub Actions — lint + `pytest`/Jest on push | |
| Testing | Backend | `pytest` | |
| Testing | Mobile | Jest + React Native Testing Library | |
 
## Folder structure
 
```
gst-voice-billing/
├── mobile/                              # React Native (Expo, dev client)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Dashboard/               # HOME
│   │   │   ├── VoiceBilling/            # VBi
│   │   │   ├── InvoiceCreate/           # INVi
│   │   │   ├── InvoicesList/
│   │   │   ├── Products/                # MASTER
│   │   │   ├── Customers/
│   │   │   ├── Inventory/
│   │   │   ├── Reports/                 # REPORTUI
│   │   │   ├── Ledger/                  # STMTUI
│   │   │   ├── ProfitLoss/              # STMTUI
│   │   │   ├── BalanceSheet/            # STMTUI
│   │   │   ├── GSTR1Export/             # GSTRUI
│   │   │   └── Settings/                # SETTINGSUI
│   │   ├── components/                  # shared UI, offline indicator, invoice preview
│   │   ├── navigation/
│   │   ├── db/                          # LOCALDB
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   ├── views/                   # LOCALVIEW
│   │   │   │   ├── customerBalances.ts
│   │   │   │   ├── profitLoss.ts
│   │   │   │   └── balanceSheet.ts
│   │   │   └── queries/                 # per-entity CRUD
│   │   ├── sync/                        # SYNCMGR
│   │   │   ├── outbox.ts
│   │   │   ├── syncManager.ts           # push/pull, retry on reconnect
│   │   │   └── netListener.ts
│   │   ├── voice/
│   │   │   ├── stt/
│   │   │   │   ├── onDeviceStt.ts       # VBp2 on-device
│   │   │   │   ├── cloudStt.ts          # VBp2 cloud → CLOUDSTT
│   │   │   │   └── sttRouter.ts         # picks path, handles unreachable fallback
│   │   │   └── nlu/                     # VBa
│   │   │       ├── tokenizer.ts
│   │   │       ├── tamilNumerals.ts
│   │   │       ├── productMatcher.ts
│   │   │       └── confidenceScorer.ts  # low confidence → routes to INVi
│   │   ├── printer/                     # PRINTp → PRINTER
│   │   ├── gstr1/                       # JSON/Excel generated on-device
│   │   ├── api/                         # REST client → GATEWAY
│   │   ├── store/
│   │   ├── i18n/                        # ta.json, en.json
│   │   ├── types/
│   │   └── App.tsx
│   ├── android/                         # via `expo prebuild` (dev client)
│   └── package.json
│
├── backend/                             # FastAPI — GATEWAY + SVC*
│   ├── app/
│   │   ├── main.py
│   │   ├── core/                        # config, JWT security, per-business auth dep
│   │   ├── api/v1/
│   │   │   ├── auth.py
│   │   │   ├── business.py              # SVCBIZ
│   │   │   ├── products.py              # SVCPROD
│   │   │   ├── customers_ledger.py      # SVCCUST — append-only, no stored balance
│   │   │   ├── invoices.py              # SVCINV
│   │   │   ├── payments.py              # SVCPAY
│   │   │   ├── expenses.py              # SVCEXP
│   │   │   ├── gstr1.py                 # SVCGSTR — stores JSON generated on-device
│   │   │   ├── reports.py               # SVCREPORT — reads VBAL/VPL/VBS
│   │   │   ├── voice_logs.py            # SVCVLOG
│   │   │   ├── suppliers.py             # SVCSUPP — optional, see notes
│   │   │   └── sync.py                  # batch push/pull for SYNCMGR
│   │   ├── models/                      # SQLAlchemy, 1:1 with ER diagram
│   │   ├── schemas/                     # Pydantic
│   │   ├── services/
│   │   │   ├── gst_calculator.py        # CGST/SGST/IGST split
│   │   │   ├── report_aggregator.py
│   │   │   ├── excel_export.py
│   │   │   └── sync_reconciler.py
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   ├── base.py
│   │   │   └── views.sql                # VBAL, VPL, VBS
│   │   └── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
│
├── docs/
│   ├── architecture.mmd
│   ├── er-diagram.md
│   ├── sql/
│   │   ├── views-postgres.sql
│   │   └── views-sqlite.sql             # kept side by side so the two can't drift
│   ├── paper/
│   └── ppt/
│
├── docker-compose.yml                   # local Postgres + backend
├── .github/workflows/ci.yml
└── README.md
```
 


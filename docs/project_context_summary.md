# Project context summary

## Project type
- Multidisciplinary semester project (India)
- Two deliverables required: a working prototype (mobile app) + an accompanying paper
- A PPT is also needed for presentation (template to be shared, content to be planned)

## The core problem: "The Unsolvable Paradox" (Catch-22 of Formalization vs. Survival)

**Problem statement:**
For the smallest micro-enterprises, the absolute cost of tax/GST compliance is structurally higher than their thin net profit margins. This means:
- Full compliance → mathematically guarantees business failure (fixed compliance cost wipes out profit)
- Staying informal → guarantees market exclusion (can't sell to GST-registered B2B buyers)

There is no safe middle ground under the current system.

### Why it's a dead-end (3 reasons)
1. **Fixed cost vs. variable margin** — A chartered accountant, compliant software, and digital infrastructure cost a fixed baseline per year. For a business on 5–10% margins, this baseline can consume the entire annual take-home profit. For a mid-sized company, the same cost is negligible.
2. **The exemption threshold trap** — Policymakers try to help via turnover-based exemptions, but exempted (unregistered) micro-enterprises become unattractive to GST-registered B2B buyers, who need Input Tax Credit (ITC) and therefore avoid buying from unregistered sellers. Exemption solves compliance cost but creates market exclusion.
3. **Technology asymmetry** — You can't simply "automate" a business out of this problem, because the cost of the automation/software tool itself is part of the financial burden it's supposed to solve.

## The proposed solution: GST Voice Billing app

A mobile app aimed at collapsing the *fixed cost of compliance* toward zero, so formalization stops being financially unviable for micro-enterprises. Built around **voice-based and text-based input** in the local language (Tamil), designed for owners with low tech/accounting literacy and limited connectivity (offline-first).

### Core idea
Replace the two expensive pieces of the compliance stack — a paid accountant and complex accounting software — with a single low/no-cost voice-first tool that a shopkeeper can operate by simply speaking a transaction.

### Features / screens (built or mocked up so far)

**Home dashboard**
- Quick access to: New Invoice, Products, Customers, Reports, Inventory, GSTR-1 Export
- "Offline" mode indicator

**Voice billing flow**
- Speak in Tamil (e.g., "ரேமெக்கு 2 அரிசி மூட்டை 1500 ரூபாய், 5 எண்ணெய் பாட்டில் 180 ரூபாய்")
- App parses natural spoken language into structured invoice line items automatically
- Toggle between Tamil voice input and keyboard/text input

**Invoice creation & preview**
- Auto-pulls HSN codes and GST rates per product
- Auto-calculates subtotal, discount, taxable amount, CGST/SGST split, and total
- GSTR-1-ready formatted tax invoice (GSTIN, invoice number, QR code)
- Print via Bluetooth thermal printer (ESC/POS) or share digitally

**Products / Inventory**
- Product master list storing name, HSN code, and GST% per item
- Enables voice input to resolve "2 rice bags" into the correct product, price, and tax rate automatically

**Invoices list**
- Filterable by All / Today / This week / This month
- Shows invoice number, date, customer, amount, payment status

**Reports**
- Total sales, total invoices, taxable amount, total GST for a selected period
- GST summary breakdown: CGST / SGST / IGST
- Visual dashboards for income/expense trends

**GSTR-1 Export (monthly)**
- Select tax period (From–To dates)
- Shows total invoices, total B2B, total B2C counts
- Generates GSTR-1 JSON file for direct upload to the GST portal (Returns > GSTR-1 > Offline Tools)
- Export as Excel, view summary

**Settings**
- Business profile, GST settings, printer settings, backup & restore, data management
- Voice settings explicitly show language + offline mode (e.g., "Tamil (Offline)")

### Planned / not yet built screens (to be added)
- **Ledger (பேரேடு)** — per-customer running account: debit, credit, and net balance, auto-derived from invoices and payments logged against that customer.
- **Profit & Loss (இலாப நஷ்ட கணக்கு)** — income (sales) minus expenses (purchases, rent, other costs) over a selected period, ending in net profit.
- **Balance sheet (இருப்பு நிலைக் குறிப்பு)** — assets (cash + bank, stock, receivables) vs. liabilities (payables), closing with owner's capital.

A mockup of these three screens has been created in the same visual style (green theme, Tamil labels) as the existing screens, since they were part of the original scope (ledgers, P&L, balance sheets, and expense/income visualizations) but weren't in the first set of mockups shared.

### How the app maps to the paradox
- Attacks **reason 1** (fixed cost vs. variable margin) by removing the recurring cost of a paid accountant and expensive software — invoicing, ledgers, P&L, and balance sheets are generated automatically as a byproduct of normal billing.
- Attacks **reason 3** (technology asymmetry) by making the "automation tool" itself low-cost/voice-first rather than another expensive system the business has to learn and pay for.
- Indirectly helps with **reason 2** (exemption trap) by making it financially feasible to register and stay GST-compliant in the first place, rather than needing to hide behind the exemption threshold.

## Open question (not yet resolved)
Whether the Tamil voice recognition is genuinely **on-device / offline** (a local speech model bundled in the app) or whether only the UI and stored data work offline while voice transcription requires an internet connection. This affects how strongly the paper can claim "zero recurring cost" / true offline operation for rural and low-connectivity users.

## Next step in progress
User will share their PPT template; content (slide-by-slide headings and bullet points) will be planned to map the Catch-22 problem → app features → how each feature breaks the trap, for the class presentation.

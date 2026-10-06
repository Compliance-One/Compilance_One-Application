-- ============================================================
-- GST Voice Billing — Backend Views (Member 4 scope)
-- VBAL: customer_balances | VPL: P&L building blocks | VBS: balance_sheet
--
-- These are the single source of truth. mobile/src/db/views/*.ts MUST
-- mirror this logic exactly — see docs/sql/views-sqlite.sql for the
-- equivalent kept side by side (per Member 1's README note).
-- ============================================================

-- ----------------------------------------------------------------
-- VBAL — customer_balances
-- Computed fresh every query, never cached (sync-safety: see schema doc)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW customer_balances AS
SELECT
    business_id,
    customer_id,
    SUM(credit) - SUM(debit) AS balance
FROM ledger_entries
GROUP BY business_id, customer_id;

-- Per-customer statement with running balance over time (Ledger screen)
CREATE OR REPLACE VIEW customer_ledger_statement AS
SELECT
    id,
    business_id,
    customer_id,
    invoice_id,
    payment_id,
    debit,
    credit,
    description,
    entry_date,
    SUM(credit - debit) OVER (
        PARTITION BY business_id, customer_id
        ORDER BY entry_date, id
    ) AS running_balance
FROM ledger_entries;

-- ----------------------------------------------------------------
-- VPL — Profit & Loss building blocks
-- A plain view can't take a date-range parameter, so these just expose
-- clean dated rows; reports.py / report_aggregator.py sums by period.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW pl_income_entries AS
SELECT
    business_id,
    id AS invoice_id,
    invoice_date AS entry_date,
    taxable_amount AS amount,   -- pre-tax revenue; GST collected is NOT income
    'sales' AS category
FROM invoices;

CREATE OR REPLACE VIEW pl_expense_entries AS
SELECT
    business_id,
    id AS expense_id,
    expense_date AS entry_date,
    amount,
    category
FROM expenses;

-- ----------------------------------------------------------------
-- VBS — Balance Sheet building blocks
--
-- KNOWN GAP — raise with the team before relying on this in the UI:
-- there is no cash/bank account table in the schema, so "cash + bank"
-- from the pitch deck cannot be computed yet. cash_and_bank is hardcoded
-- to 0 below so nobody mistakes it for a real figure.
--
-- Payables only returns real numbers if suppliers/purchases are actually
-- used in your deployment (the schema doc marks that pair optional).
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW bs_stock_value AS
SELECT
    business_id,
    SUM(stock_quantity * price) AS stock_value
FROM products
GROUP BY business_id;

CREATE OR REPLACE VIEW bs_receivables AS
SELECT
    business_id,
    SUM(balance) AS receivables
FROM customer_balances
WHERE balance > 0
GROUP BY business_id;

CREATE OR REPLACE VIEW bs_payables AS
SELECT
    business_id,
    SUM(amount) AS payables
FROM purchases
WHERE payment_status = 'unpaid'
GROUP BY business_id;

CREATE OR REPLACE VIEW balance_sheet AS
SELECT
    b.id AS business_id,
    0::numeric AS cash_and_bank,  -- TODO: no cash/bank table yet — see note above
    COALESCE(s.stock_value, 0) AS stock_value,
    COALESCE(r.receivables, 0) AS receivables,
    COALESCE(p.payables, 0) AS payables,
    (COALESCE(s.stock_value, 0) + COALESCE(r.receivables, 0))
        - COALESCE(p.payables, 0) AS owners_capital  -- plug figure until a real equity table exists
FROM businesses b
LEFT JOIN bs_stock_value s ON s.business_id = b.id
LEFT JOIN bs_receivables r ON r.business_id = b.id
LEFT JOIN bs_payables p ON p.business_id = b.id;

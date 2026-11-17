"""SQLite report views shared by Alembic and the test suite.

Balances are always computed, never cached. SQL is written for SQLite
(no `CREATE OR REPLACE`, no `::numeric` casts, no Postgres functions).
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection

# Drop dependents first.
VIEW_DROP_ORDER = [
    "v_balance_sheet",
    "v_bs_payables",
    "v_bs_receivables",
    "v_bs_stock_value",
    "v_pl_expense_entries",
    "v_pl_income_entries",
    "v_customer_ledger_statement",
    "v_customer_balances",
]

VIEW_DEFINITIONS: list[tuple[str, str]] = [
    (
        "v_customer_balances",
        """
        CREATE VIEW v_customer_balances AS
        SELECT
            business_id,
            customer_id,
            SUM(credit) - SUM(debit) AS balance
        FROM ledger_entries
        GROUP BY business_id, customer_id
        """,
    ),
    (
        "v_customer_ledger_statement",
        """
        CREATE VIEW v_customer_ledger_statement AS
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
        FROM ledger_entries
        """,
    ),
    (
        "v_pl_income_entries",
        """
        CREATE VIEW v_pl_income_entries AS
        SELECT
            business_id,
            id AS invoice_id,
            invoice_date AS entry_date,
            taxable_amount AS amount,
            'sales' AS category
        FROM invoices
        """,
    ),
    (
        "v_pl_expense_entries",
        """
        CREATE VIEW v_pl_expense_entries AS
        SELECT
            business_id,
            id AS expense_id,
            expense_date AS entry_date,
            amount,
            category
        FROM expenses
        """,
    ),
    (
        "v_bs_stock_value",
        """
        CREATE VIEW v_bs_stock_value AS
        SELECT business_id, SUM(stock_quantity * price) AS stock_value
        FROM products
        GROUP BY business_id
        """,
    ),
    (
        "v_bs_receivables",
        """
        CREATE VIEW v_bs_receivables AS
        SELECT business_id, SUM(balance) AS receivables
        FROM v_customer_balances
        WHERE balance > 0
        GROUP BY business_id
        """,
    ),
    (
        "v_bs_payables",
        """
        CREATE VIEW v_bs_payables AS
        SELECT business_id, SUM(amount) AS payables
        FROM purchases
        WHERE UPPER(COALESCE(payment_status, '')) = 'UNPAID'
        GROUP BY business_id
        """,
    ),
    (
        "v_balance_sheet",
        """
        CREATE VIEW v_balance_sheet AS
        WITH payments_by_mode AS (
            SELECT i.business_id,
                   UPPER(COALESCE(p.payment_mode, 'CASH')) AS mode,
                   SUM(p.amount) AS amt
            FROM payments p
            JOIN invoices i ON i.id = p.invoice_id
            GROUP BY i.business_id, UPPER(COALESCE(p.payment_mode, 'CASH'))
        ),
        expenses_by_mode AS (
            SELECT business_id,
                   UPPER(COALESCE(payment_mode, 'CASH')) AS mode,
                   SUM(amount) AS amt
            FROM expenses
            GROUP BY business_id, UPPER(COALESCE(payment_mode, 'CASH'))
        ),
        purchases_by_mode AS (
            SELECT business_id,
                   UPPER(COALESCE(payment_mode, 'CASH')) AS mode,
                   SUM(amount) AS amt
            FROM purchases
            WHERE UPPER(COALESCE(payment_status, '')) = 'PAID'
            GROUP BY business_id, UPPER(COALESCE(payment_mode, 'CASH'))
        ),
        cash_bank AS (
            SELECT
                b.id AS business_id,
                COALESCE(b.opening_cash_balance, 0)
                    + COALESCE((
                        SELECT SUM(amt) FROM payments_by_mode x
                        WHERE x.business_id = b.id AND x.mode = 'CASH'
                    ), 0)
                    - COALESCE((
                        SELECT SUM(amt) FROM expenses_by_mode x
                        WHERE x.business_id = b.id AND x.mode = 'CASH'
                    ), 0)
                    - COALESCE((
                        SELECT SUM(amt) FROM purchases_by_mode x
                        WHERE x.business_id = b.id AND x.mode = 'CASH'
                    ), 0) AS cash,
                COALESCE(b.opening_bank_balance, 0)
                    + COALESCE((
                        SELECT SUM(amt) FROM payments_by_mode x
                        WHERE x.business_id = b.id AND x.mode IN ('BANK', 'UPI')
                    ), 0)
                    - COALESCE((
                        SELECT SUM(amt) FROM expenses_by_mode x
                        WHERE x.business_id = b.id AND x.mode IN ('BANK', 'UPI')
                    ), 0)
                    - COALESCE((
                        SELECT SUM(amt) FROM purchases_by_mode x
                        WHERE x.business_id = b.id AND x.mode IN ('BANK', 'UPI')
                    ), 0) AS bank
            FROM businesses b
        )
        SELECT
            b.id AS business_id,
            COALESCE(cb.cash, 0) AS cash,
            COALESCE(cb.bank, 0) AS bank,
            COALESCE(cb.cash, 0) + COALESCE(cb.bank, 0) AS cash_and_bank,
            COALESCE(s.stock_value, 0) AS stock_value,
            COALESCE(r.receivables, 0) AS receivables,
            COALESCE(p.payables, 0) AS payables,
            (COALESCE(cb.cash, 0) + COALESCE(cb.bank, 0)
                + COALESCE(s.stock_value, 0) + COALESCE(r.receivables, 0))
                - COALESCE(p.payables, 0) AS owners_capital
        FROM businesses b
        LEFT JOIN cash_bank cb ON cb.business_id = b.id
        LEFT JOIN v_bs_stock_value s ON s.business_id = b.id
        LEFT JOIN v_bs_receivables r ON r.business_id = b.id
        LEFT JOIN v_bs_payables p ON p.business_id = b.id
        """,
    ),
]


def drop_report_views(connection: Connection) -> None:
    for name in VIEW_DROP_ORDER:
        connection.execute(text(f"DROP VIEW IF EXISTS {name}"))


def apply_report_views(connection: Connection) -> None:
    drop_report_views(connection)
    for _name, ddl in VIEW_DEFINITIONS:
        connection.execute(text(ddl))

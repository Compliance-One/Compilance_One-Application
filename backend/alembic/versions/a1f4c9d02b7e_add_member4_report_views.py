"""add member4 report views (customer balances, P&L, balance sheet)

Revision ID: a1f4c9d02b7e
Revises: 0ef373e7815c
Create Date: 2026-10-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1f4c9d02b7e"
down_revision: Union[str, Sequence[str], None] = "0ef373e7815c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Matches the formula already shipped in mobile/src/db/schema.ts
    # (v_customer_balances): credit - debit, never cached.
    op.execute(
        """
        CREATE OR REPLACE VIEW v_customer_balances AS
        SELECT
            business_id,
            customer_id,
            SUM(credit) - SUM(debit) AS balance
        FROM ledger_entries
        GROUP BY business_id, customer_id;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_customer_ledger_statement AS
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
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_pl_income_entries AS
        SELECT
            business_id,
            id AS invoice_id,
            invoice_date AS entry_date,
            taxable_amount AS amount,
            'sales' AS category
        FROM invoices;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_pl_expense_entries AS
        SELECT
            business_id,
            id AS expense_id,
            expense_date AS entry_date,
            amount,
            category
        FROM expenses;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_bs_stock_value AS
        SELECT business_id, SUM(stock_quantity * price) AS stock_value
        FROM products
        GROUP BY business_id;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_bs_receivables AS
        SELECT business_id, SUM(balance) AS receivables
        FROM v_customer_balances
        WHERE balance > 0
        GROUP BY business_id;
        """
    )

    # UPPER() because invoices/purchases payment_status is stored
    # inconsistently cased across the codebase (see schema.ts CHECK
    # constraint vs entities.py default) — normalize at read time until
    # that gets fixed at the source.
    op.execute(
        """
        CREATE OR REPLACE VIEW v_bs_payables AS
        SELECT business_id, SUM(amount) AS payables
        FROM purchases
        WHERE UPPER(payment_status) = 'UNPAID'
        GROUP BY business_id;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_balance_sheet AS
        SELECT
            b.id AS business_id,
            0::numeric AS cash_and_bank,
            COALESCE(s.stock_value, 0) AS stock_value,
            COALESCE(r.receivables, 0) AS receivables,
            COALESCE(p.payables, 0) AS payables,
            (COALESCE(s.stock_value, 0) + COALESCE(r.receivables, 0))
                - COALESCE(p.payables, 0) AS owners_capital
        FROM businesses b
        LEFT JOIN v_bs_stock_value s ON s.business_id = b.id
        LEFT JOIN v_bs_receivables r ON r.business_id = b.id
        LEFT JOIN v_bs_payables p ON p.business_id = b.id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_balance_sheet;")
    op.execute("DROP VIEW IF EXISTS v_bs_payables;")
    op.execute("DROP VIEW IF EXISTS v_bs_receivables;")
    op.execute("DROP VIEW IF EXISTS v_bs_stock_value;")
    op.execute("DROP VIEW IF EXISTS v_pl_expense_entries;")
    op.execute("DROP VIEW IF EXISTS v_pl_income_entries;")
    op.execute("DROP VIEW IF EXISTS v_customer_ledger_statement;")
    op.execute("DROP VIEW IF EXISTS v_customer_balances;")

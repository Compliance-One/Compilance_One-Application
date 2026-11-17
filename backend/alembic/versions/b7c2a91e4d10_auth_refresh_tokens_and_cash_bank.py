"""Auth refresh tokens, opening balances, payment modes, cash/bank on BS.

Revision ID: b7c2a91e4d10
Revises: a1f4c9d02b7e
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b7c2a91e4d10"
down_revision: Union[str, Sequence[str], None] = "a1f4c9d02b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    op.alter_column("businesses", "gstin", existing_type=sa.String(), nullable=True)

    op.add_column(
        "businesses",
        sa.Column("opening_cash_balance", sa.Numeric(), server_default="0"),
    )
    op.add_column(
        "businesses",
        sa.Column("opening_bank_balance", sa.Numeric(), server_default="0"),
    )

    op.add_column(
        "expenses",
        sa.Column("payment_mode", sa.String(), server_default="CASH"),
    )
    op.add_column(
        "purchases",
        sa.Column("payment_mode", sa.String(), server_default="CASH"),
    )

    # Normalize existing payment modes to the canonical uppercase set.
    op.execute(
        """
        UPDATE payments
        SET payment_mode = UPPER(COALESCE(payment_mode, 'CASH'))
        """
    )

    op.execute("DROP VIEW IF EXISTS v_balance_sheet;")
    op.execute(
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
            WHERE UPPER(COALESCE(payment_status, '')) IN ('PAID')
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
        LEFT JOIN v_bs_payables p ON p.business_id = b.id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_balance_sheet;")
    op.execute(
        """
        CREATE VIEW v_balance_sheet AS
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
    op.drop_column("purchases", "payment_mode")
    op.drop_column("expenses", "payment_mode")
    op.drop_column("businesses", "opening_bank_balance")
    op.drop_column("businesses", "opening_cash_balance")
    op.alter_column("businesses", "gstin", existing_type=sa.String(), nullable=False)
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

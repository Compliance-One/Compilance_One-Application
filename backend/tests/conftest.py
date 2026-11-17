import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import Base, get_db_session
from backend.app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# SQLite-compatible counterparts of the Postgres report views.
SQLITE_REPORT_VIEWS = """
CREATE VIEW IF NOT EXISTS v_customer_balances AS
SELECT business_id, id AS customer_id, 0.0 AS balance
FROM customers;

CREATE VIEW IF NOT EXISTS v_bs_stock_value AS
SELECT business_id, SUM(stock_quantity * price) AS stock_value
FROM products
GROUP BY business_id;

CREATE VIEW IF NOT EXISTS v_bs_receivables AS
SELECT business_id, SUM(balance) AS receivables
FROM v_customer_balances
WHERE balance > 0
GROUP BY business_id;

CREATE VIEW IF NOT EXISTS v_bs_payables AS
SELECT business_id, SUM(amount) AS payables
FROM purchases
WHERE UPPER(COALESCE(payment_status, '')) = 'UNPAID'
GROUP BY business_id;

CREATE VIEW IF NOT EXISTS v_balance_sheet AS
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
LEFT JOIN v_bs_payables p ON p.business_id = b.id;
"""


@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for statement in SQLITE_REPORT_VIEWS.split(";"):
            stmt = statement.strip()
            if stmt:
                await conn.execute(text(stmt))

    async with async_session_maker() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_client(async_session: AsyncSession):
    async def override_get_db_session():
        yield async_session

    app.dependency_overrides[get_db_session] = override_get_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


async def register_user(client: AsyncClient, phone: str, password: str = "secret123", email: str | None = None, name: str = "Test User"):
    payload = {"name": name, "phone": phone, "password": password}
    if email:
        payload["email"] = email
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def bearer(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}

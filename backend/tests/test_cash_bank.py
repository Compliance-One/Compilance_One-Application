import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from backend.tests.conftest import bearer, register_user


@pytest.mark.asyncio
async def test_balance_sheet_cash_and_bank(test_client: AsyncClient):
    tokens = await register_user(test_client, phone="9444444444")
    headers = bearer(tokens)
    business_id = str(uuid.uuid4())
    invoice_id = str(uuid.uuid4())
    cash_payment_id = str(uuid.uuid4())
    upi_payment_id = str(uuid.uuid4())
    cash_expense_id = str(uuid.uuid4())
    bank_expense_id = str(uuid.uuid4())
    supplier_id = str(uuid.uuid4())
    purchase_id = str(uuid.uuid4())

    items = [
        {
            "outbox_id": 1,
            "entity_type": "businesses",
            "entity_id": business_id,
            "operation": "INSERT",
            "data": {
                "business_name": "Cash Shop",
                "gstin": "33CCCCC2222C1Z3",
                "voice_language": "ta-IN",
                "opening_cash_balance": 1000,
                "opening_bank_balance": 5000,
            },
        },
        {
            "outbox_id": 2,
            "entity_type": "invoices",
            "entity_id": invoice_id,
            "operation": "INSERT",
            "data": {
                "business_id": business_id,
                "invoice_number": "INV-1",
                "invoice_date": date.today().isoformat(),
                "total_amount": 500,
                "payment_status": "PAID",
            },
        },
        {
            "outbox_id": 3,
            "entity_type": "payments",
            "entity_id": cash_payment_id,
            "operation": "INSERT",
            "data": {
                "invoice_id": invoice_id,
                "amount": 200,
                "payment_mode": "CASH",
                "payment_date": date.today().isoformat(),
            },
        },
        {
            "outbox_id": 4,
            "entity_type": "payments",
            "entity_id": upi_payment_id,
            "operation": "INSERT",
            "data": {
                "invoice_id": invoice_id,
                "amount": 300,
                "payment_mode": "UPI",
                "payment_date": date.today().isoformat(),
            },
        },
        {
            "outbox_id": 5,
            "entity_type": "expenses",
            "entity_id": cash_expense_id,
            "operation": "INSERT",
            "data": {
                "business_id": business_id,
                "category": "rent",
                "amount": 50,
                "expense_date": date.today().isoformat(),
                "payment_mode": "CASH",
            },
        },
        {
            "outbox_id": 6,
            "entity_type": "expenses",
            "entity_id": bank_expense_id,
            "operation": "INSERT",
            "data": {
                "business_id": business_id,
                "category": "utilities",
                "amount": 100,
                "expense_date": date.today().isoformat(),
                "payment_mode": "BANK",
            },
        },
        {
            "outbox_id": 7,
            "entity_type": "suppliers",
            "entity_id": supplier_id,
            "operation": "INSERT",
            "data": {
                "business_id": business_id,
                "name": "Wholesale Mart",
            },
        },
        {
            "outbox_id": 8,
            "entity_type": "purchases",
            "entity_id": purchase_id,
            "operation": "INSERT",
            "data": {
                "business_id": business_id,
                "supplier_id": supplier_id,
                "amount": 400,
                "purchase_date": date.today().isoformat(),
                "payment_status": "PAID",
                "payment_mode": "BANK",
            },
        },
    ]

    push = await test_client.post("/api/v1/sync/push", json={"items": items}, headers=headers)
    assert push.status_code == 200, push.text
    assert sorted(push.json()["processed_ids"]) == list(range(1, 9)), push.json()

    sheet = await test_client.get(
        f"/api/v1/reports/balance-sheet?business_id={business_id}",
        headers=headers,
    )
    assert sheet.status_code == 200, sheet.text
    body = sheet.json()
    # cash = 1000 opening + 200 received - 50 expense = 1150
    # bank = 5000 opening + 300 UPI - 100 expense - 400 purchase = 4800
    assert body["cash"] == 1150
    assert body["bank"] == 4800
    assert body["cash_and_bank"] == 5950


@pytest.mark.asyncio
async def test_balance_sheet_rejects_other_user(test_client: AsyncClient):
    owner = await register_user(test_client, phone="9555555555")
    other = await register_user(test_client, phone="9666666666")
    business_id = str(uuid.uuid4())
    push = await test_client.post(
        "/api/v1/sync/push",
        headers=bearer(owner),
        json={
            "items": [
                {
                    "outbox_id": 1,
                    "entity_type": "businesses",
                    "entity_id": business_id,
                    "operation": "INSERT",
                    "data": {"business_name": "Private", "opening_cash_balance": 10},
                }
            ]
        },
    )
    assert push.status_code == 200
    denied = await test_client.get(
        f"/api/v1/reports/balance-sheet?business_id={business_id}",
        headers=bearer(other),
    )
    assert denied.status_code == 403

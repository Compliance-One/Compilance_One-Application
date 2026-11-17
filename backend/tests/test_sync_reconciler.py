import uuid

import pytest
from httpx import AsyncClient

from backend.tests.conftest import bearer, register_user


@pytest.mark.asyncio
async def test_reconcile_batch_insert_and_update(test_client: AsyncClient):
    tokens = await register_user(test_client, phone="9000000001")
    headers = bearer(tokens)
    business_id = str(uuid.uuid4())
    customer_id = str(uuid.uuid4())

    payload = {
        "items": [
            {
                "outbox_id": 1,
                "entity_type": "businesses",
                "entity_id": business_id,
                "operation": "INSERT",
                "data": {
                    "business_name": "Test Store",
                    "gstin": "33AAAAA0000A1Z5",
                    "voice_language": "ta-IN",
                    "offline_mode": True
                }
            },
            {
                "outbox_id": 2,
                "entity_type": "customers",
                "entity_id": customer_id,
                "operation": "INSERT",
                "data": {
                    "business_id": business_id,
                    "name": "Karthik Traders",
                    "phone": "9876543210",
                    "customer_type": "B2C"
                }
            }
        ]
    }

    response = await test_client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    res_data = response.json()
    assert res_data["processed_ids"] == [1, 2]
    assert res_data["failed_ids"] == []

    update_payload = {
        "items": [
            {
                "outbox_id": 3,
                "entity_type": "customers",
                "entity_id": customer_id,
                "operation": "UPDATE",
                "data": {
                    "business_id": business_id,
                    "name": "Karthik Traders Updated",
                    "phone": "9876543210",
                    "customer_type": "B2C"
                }
            }
        ]
    }

    update_resp = await test_client.post("/api/v1/sync/push", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["processed_ids"] == [3]
    assert update_resp.json()["failed_ids"] == []


@pytest.mark.asyncio
async def test_reconcile_batch_unknown_entity_fails(test_client: AsyncClient):
    tokens = await register_user(test_client, phone="9000000002")
    headers = bearer(tokens)
    payload = {
        "items": [
            {
                "outbox_id": 99,
                "entity_type": "unknown_table",
                "entity_id": str(uuid.uuid4()),
                "operation": "INSERT",
                "data": {"name": "invalid"}
            }
        ]
    }

    response = await test_client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["processed_ids"] == []
    assert res_data["failed_ids"] == [99]


@pytest.mark.asyncio
async def test_sync_pull_endpoint(test_client: AsyncClient):
    tokens = await register_user(test_client, phone="9000000003")
    headers = bearer(tokens)
    business_id = str(uuid.uuid4())
    customer_id = str(uuid.uuid4())

    push_payload = {
        "items": [
            {
                "outbox_id": 101,
                "entity_type": "businesses",
                "entity_id": business_id,
                "operation": "INSERT",
                "data": {
                    "business_name": "Pull Test Enterprise",
                    "gstin": "33BBBBB1111B1Z2",
                    "voice_language": "ta-IN",
                    "offline_mode": True
                }
            },
            {
                "outbox_id": 102,
                "entity_type": "customers",
                "entity_id": customer_id,
                "operation": "INSERT",
                "data": {
                    "business_id": business_id,
                    "name": "Live Test Customer",
                    "phone": "9998887776",
                    "customer_type": "B2C"
                }
            }
        ]
    }
    push_res = await test_client.post("/api/v1/sync/push", json=push_payload, headers=headers)
    assert push_res.status_code == 200, push_res.text
    assert 101 in push_res.json()["processed_ids"]
    assert 102 in push_res.json()["processed_ids"]

    pull_res = await test_client.get(f"/api/v1/sync/pull?business_id={business_id}", headers=headers)
    assert pull_res.status_code == 200, pull_res.text
    data = pull_res.json()

    assert "server_time" in data
    assert "changes" in data
    assert len(data["changes"]["businesses"]) == 1
    assert data["changes"]["businesses"][0]["id"] == business_id
    assert len(data["changes"]["customers"]) == 1
    assert data["changes"]["customers"][0]["id"] == customer_id


@pytest.mark.asyncio
async def test_sync_requires_auth(test_client: AsyncClient):
    response = await test_client.post("/api/v1/sync/push", json={"items": []})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_sync_pull_rejects_other_users_business(test_client: AsyncClient):
    owner = await register_user(test_client, phone="9000000004")
    other = await register_user(test_client, phone="9000000005")
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
                    "data": {"business_name": "Owner Store", "voice_language": "ta-IN"},
                }
            ]
        },
    )
    assert push.status_code == 200, push.text
    assert push.json()["processed_ids"] == [1]

    denied = await test_client.get(
        f"/api/v1/sync/pull?business_id={business_id}",
        headers=bearer(other),
    )
    assert denied.status_code == 403

    # Pushing a customer into someone else's business is dropped.
    hijack = await test_client.post(
        "/api/v1/sync/push",
        headers=bearer(other),
        json={
            "items": [
                {
                    "outbox_id": 2,
                    "entity_type": "customers",
                    "entity_id": str(uuid.uuid4()),
                    "operation": "INSERT",
                    "data": {
                        "business_id": business_id,
                        "name": "Stolen",
                        "customer_type": "B2C",
                    },
                }
            ]
        },
    )
    assert hijack.status_code == 200
    assert hijack.json()["failed_ids"] == [2]


def _mobile_business_payload(business_id: str, owner_id: str, **overrides) -> dict:
    """Mirrors toSyncPayload('businesses', ...) from mobile ensureBusinessLinked()."""
    data = {
        "id": business_id,
        "owner_user_id": owner_id,
        "business_name": "My Business",
        "gstin": None,
        "address": None,
        "phone": None,
        "financial_year_start": "2026-04-01",  # ISO date string -> Date column
        "voice_language": "ta-IN",
        "offline_mode": 1,  # SQLite int -> Boolean column
        "printer_settings": None,
        "opening_cash_balance": 0,
        "opening_bank_balance": 0,
        "created_at": "2026-11-18",  # localISODate(): date-only string -> DateTime column
    }
    data.update(overrides)
    return data


@pytest.mark.asyncio
async def test_push_mobile_business_then_pull(test_client: AsyncClient):
    """Regression: a real mobile 'businesses' payload must upsert, so pull no longer 404s."""
    tokens = await register_user(test_client, phone="9000000010")
    headers = bearer(tokens)
    owner_id = tokens["user"]["id"]
    business_id = str(uuid.uuid4())

    # Before the business reaches the server, pull is a 404.
    pre = await test_client.get("/api/v1/sync/pull", params={"business_id": business_id}, headers=headers)
    assert pre.status_code == 404

    push = await test_client.post(
        "/api/v1/sync/push",
        json={
            "items": [
                {
                    "outbox_id": 1,
                    "entity_type": "businesses",
                    "entity_id": business_id,
                    "operation": "INSERT",
                    "data": _mobile_business_payload(business_id, owner_id),
                }
            ]
        },
        headers=headers,
    )
    assert push.status_code == 200, push.text
    assert push.json() == {"processed_ids": [1], "failed_ids": []}

    pull = await test_client.get("/api/v1/sync/pull", params={"business_id": business_id}, headers=headers)
    assert pull.status_code == 200, pull.text
    rows = pull.json()["changes"]["businesses"]
    assert len(rows) == 1
    assert rows[0]["id"] == business_id
    assert rows[0]["owner_user_id"] == owner_id
    assert rows[0]["financial_year_start"] == "2026-04-01"
    assert rows[0]["offline_mode"] == 1


@pytest.mark.asyncio
async def test_push_business_update_and_children_then_pull(test_client: AsyncClient):
    tokens = await register_user(test_client, phone="9000000011")
    headers = bearer(tokens)
    owner_id = tokens["user"]["id"]
    business_id = str(uuid.uuid4())
    customer_id = str(uuid.uuid4())

    def push(items):
        return test_client.post("/api/v1/sync/push", json={"items": items}, headers=headers)

    first = await push(
        [
            {"outbox_id": 1, "entity_type": "businesses", "entity_id": business_id, "operation": "INSERT",
             "data": _mobile_business_payload(business_id, owner_id, created_at="2026-11-18 10:30:00")},
            {"outbox_id": 2, "entity_type": "customers", "entity_id": customer_id, "operation": "INSERT",
             "data": {"id": customer_id, "business_id": business_id, "name": "Karthik", "phone": None,
                      "address": None, "gstin": "", "customer_type": "B2C", "created_at": "2026-11-18T10:30:00Z"}},
        ]
    )
    assert first.json() == {"processed_ids": [1, 2], "failed_ids": []}

    # Profile edit: GSTIN set and opening balances as floats; blank gstin on a business becomes NULL.
    second = await push(
        [
            {"outbox_id": 3, "entity_type": "businesses", "entity_id": business_id, "operation": "UPDATE",
             "data": _mobile_business_payload(business_id, owner_id, business_name="Sathya Stores",
                                              gstin="33AAAAA0000A1Z5", opening_cash_balance=1500.5,
                                              opening_bank_balance=200)},
        ]
    )
    assert second.json() == {"processed_ids": [3], "failed_ids": []}

    # A second business with a blank GSTIN must not trip the UNIQUE(gstin) constraint.
    other_id = str(uuid.uuid4())
    third = await push(
        [
            {"outbox_id": 4, "entity_type": "businesses", "entity_id": other_id, "operation": "INSERT",
             "data": _mobile_business_payload(other_id, owner_id, gstin="")},
        ]
    )
    assert third.json() == {"processed_ids": [4], "failed_ids": []}

    pull = await test_client.get("/api/v1/sync/pull", params={"business_id": business_id}, headers=headers)
    assert pull.status_code == 200, pull.text
    changes = pull.json()["changes"]
    assert changes["businesses"][0]["business_name"] == "Sathya Stores"
    assert changes["businesses"][0]["opening_cash_balance"] == 1500.5
    assert [c["id"] for c in changes["customers"]] == [customer_id]


@pytest.mark.asyncio
async def test_failed_item_exception_is_logged(test_client: AsyncClient, caplog):
    tokens = await register_user(test_client, phone="9000000012")
    headers = bearer(tokens)
    business_id = str(uuid.uuid4())
    with caplog.at_level("ERROR", logger="app.services.sync_reconciler"):
        res = await test_client.post(
            "/api/v1/sync/push",
            json={"items": [{"outbox_id": 9, "entity_type": "businesses", "entity_id": business_id,
                             "operation": "INSERT",
                             "data": {"business_name": "Bad", "financial_year_start": "not-a-date"}}]},
            headers=headers,
        )
    assert res.json() == {"processed_ids": [], "failed_ids": [9]}
    assert any(business_id in r.getMessage() and r.exc_info for r in caplog.records)

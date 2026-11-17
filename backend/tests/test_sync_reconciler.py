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

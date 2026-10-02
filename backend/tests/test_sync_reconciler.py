import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.db.session import Base, get_db_session

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
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

@pytest.mark.asyncio
async def test_reconcile_batch_insert_and_update(test_client: AsyncClient):
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

    response = await test_client.post("/api/v1/sync/push", json=payload)
    assert response.status_code == 200
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

    update_resp = await test_client.post("/api/v1/sync/push", json=update_payload)
    assert update_resp.status_code == 200
    assert update_resp.json()["processed_ids"] == [3]
    assert update_resp.json()["failed_ids"] == []

@pytest.mark.asyncio
async def test_reconcile_batch_unknown_entity_fails(test_client: AsyncClient):
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

    response = await test_client.post("/api/v1/sync/push", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["processed_ids"] == []
    assert res_data["failed_ids"] == [99]

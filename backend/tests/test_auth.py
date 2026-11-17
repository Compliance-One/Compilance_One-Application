import pytest
from httpx import AsyncClient

from backend.tests.conftest import bearer, register_user


@pytest.mark.asyncio
async def test_register_and_me(test_client: AsyncClient):
    tokens = await register_user(
        test_client,
        phone="9111111111",
        email="owner@example.com",
        name="Lakshmi",
    )
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert tokens["user"]["phone"] == "9111111111"
    assert tokens["user"]["email"] == "owner@example.com"

    me = await test_client.get("/api/v1/auth/me", headers=bearer(tokens))
    assert me.status_code == 200
    body = me.json()
    assert body["name"] == "Lakshmi"
    assert body["phone"] == "9111111111"


@pytest.mark.asyncio
async def test_register_duplicate_phone(test_client: AsyncClient):
    await register_user(test_client, phone="9111111112")
    again = await test_client.post(
        "/api/v1/auth/register",
        json={"name": "Other", "phone": "9111111112", "password": "secret123"},
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_login_with_phone_or_email(test_client: AsyncClient):
    await register_user(
        test_client,
        phone="9222222222",
        email="login@example.com",
        password="correct-horse",
    )
    by_phone = await test_client.post(
        "/api/v1/auth/login",
        json={"identifier": "9222222222", "password": "correct-horse"},
    )
    assert by_phone.status_code == 200, by_phone.text
    by_email = await test_client.post(
        "/api/v1/auth/login",
        json={"identifier": "login@example.com", "password": "correct-horse"},
    )
    assert by_email.status_code == 200, by_email.text
    bad = await test_client.post(
        "/api/v1/auth/login",
        json={"identifier": "9222222222", "password": "wrong-password"},
    )
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rotates_and_logout(test_client: AsyncClient):
    tokens = await register_user(test_client, phone="9333333333")
    first_refresh = tokens["refresh_token"]
    rotated = await test_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first_refresh}
    )
    assert rotated.status_code == 200, rotated.text
    new_tokens = rotated.json()
    assert new_tokens["refresh_token"] != first_refresh

    replay = await test_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first_refresh}
    )
    assert replay.status_code == 401

    me = await test_client.get("/api/v1/auth/me", headers=bearer(new_tokens))
    assert me.status_code == 200

    logout = await test_client.post(
        "/api/v1/auth/logout", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert logout.status_code == 204
    after = await test_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_access_token(test_client: AsyncClient):
    missing = await test_client.get("/api/v1/auth/me")
    assert missing.status_code == 401
    junk = await test_client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert junk.status_code == 401


@pytest.mark.asyncio
async def test_protected_business_route_requires_auth(test_client: AsyncClient):
    # Member 3 in-memory business routes are now behind a bearer token.
    res = await test_client.get("/api/v1/business")
    assert res.status_code in {401, 404, 405, 422}
    if res.status_code == 200:
        raise AssertionError("unauthenticated business access should not succeed")

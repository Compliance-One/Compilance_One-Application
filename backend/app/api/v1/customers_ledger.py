"""
Customer & Ledger reporting endpoints. No auth layer exists in this repo
yet (see sync.py) — business_id is passed as a plain query param, same
convention as /api/v1/sync/pull. Update this file when real auth lands.
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


class CustomerBalance(BaseModel):
    customer_id: uuid.UUID
    balance: float


class LedgerEntry(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    invoice_id: Optional[uuid.UUID]
    payment_id: Optional[uuid.UUID]
    debit: float
    credit: float
    description: Optional[str]
    entry_date: date
    running_balance: float


@router.get("/balances", response_model=list[CustomerBalance])
async def list_customer_balances(
    business_id: uuid.UUID = Query(..., description="Target business UUID"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT customer_id, balance
            FROM v_customer_balances
            WHERE business_id = :business_id
            ORDER BY balance DESC
            """
        ),
        {"business_id": str(business_id)},
    )
    rows = result.mappings().all()
    return [CustomerBalance(**row) for row in rows]


@router.get("/{customer_id}/statement", response_model=list[LedgerEntry])
async def customer_statement(
    customer_id: uuid.UUID,
    business_id: uuid.UUID = Query(..., description="Target business UUID"),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT id, customer_id, invoice_id, payment_id, debit, credit,
                   description, entry_date, running_balance
            FROM v_customer_ledger_statement
            WHERE business_id = :business_id
              AND customer_id = :customer_id
              AND (:from_date IS NULL OR entry_date >= :from_date)
              AND (:to_date IS NULL OR entry_date <= :to_date)
            ORDER BY entry_date, id
            """
        ),
        {
            "business_id": str(business_id),
            "customer_id": str(customer_id),
            "from_date": from_date,
            "to_date": to_date,
        },
    )
    rows = result.mappings().all()
    return [LedgerEntry(**row) for row in rows]

"""
Customer & Ledger reporting endpoints (SVCCUST reporting side).

NOTE: the actual customer CRUD (create/edit customer) belongs wherever
Member 3 builds customers.py. This file only exposes read endpoints over
the ledger views — it never writes a balance, matching the schema's
append-only design.

TODO (integration): replace `get_db` and `get_current_business_id` imports
below with whatever Member 1 / Member 2 actually name their dependencies
in app/db/session.py and app/core/security.py.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db  # TODO: confirm actual path/name with Member 1
from app.core.security import get_current_business_id  # TODO: confirm with Member 2

router = APIRouter(prefix="/customers-ledger", tags=["ledger"])


class CustomerBalance(BaseModel):
    customer_id: UUID
    balance: float


class LedgerEntry(BaseModel):
    id: UUID
    customer_id: UUID
    invoice_id: Optional[UUID]
    payment_id: Optional[UUID]
    debit: float
    credit: float
    description: Optional[str]
    entry_date: date
    running_balance: float


@router.get("/balances", response_model=list[CustomerBalance])
def list_customer_balances(
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    """Current balance for every customer of this business (VBAL)."""
    rows = db.execute(
        text(
            """
            SELECT customer_id, balance
            FROM customer_balances
            WHERE business_id = :business_id
            ORDER BY balance DESC
            """
        ),
        {"business_id": str(business_id)},
    ).mappings().all()
    return [CustomerBalance(**row) for row in rows]


@router.get("/{customer_id}/statement", response_model=list[LedgerEntry])
def customer_statement(
    customer_id: UUID,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    """Full running-balance statement for one customer (Ledger screen)."""
    rows = db.execute(
        text(
            """
            SELECT id, customer_id, invoice_id, payment_id, debit, credit,
                   description, entry_date, running_balance
            FROM customer_ledger_statement
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
    ).mappings().all()
    return [LedgerEntry(**row) for row in rows]

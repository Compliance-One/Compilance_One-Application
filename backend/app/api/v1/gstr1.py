"""
GSTR-1 export audit endpoint. The JSON itself is generated ON-DEVICE
(mobile/src/gstr1/generateGstr1.ts), fully offline — this just records
that an export happened, for audit/history purposes once the device syncs.
"""

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


class Gstr1ExportIn(BaseModel):
    period_from: date
    period_to: date
    total_invoices: int
    total_b2b: int
    total_b2c: int
    json_file_path: str
    status: str = "generated"


class Gstr1ExportOut(Gstr1ExportIn):
    id: uuid.UUID
    business_id: uuid.UUID
    generated_at: datetime


@router.post("", response_model=Gstr1ExportOut)
async def record_gstr1_export(
    payload: Gstr1ExportIn,
    business_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    new_id = uuid.uuid4()
    result = await db.execute(
        text(
            """
            INSERT INTO gstr1_exports
                (id, business_id, period_from, period_to, total_invoices,
                 total_b2b, total_b2c, json_file_path, status, generated_at)
            VALUES
                (:id, :business_id, :period_from, :period_to,
                 :total_invoices, :total_b2b, :total_b2c, :json_file_path,
                 :status, now())
            RETURNING id, business_id, period_from, period_to,
                      total_invoices, total_b2b, total_b2c,
                      json_file_path, status, generated_at
            """
        ),
        {"id": str(new_id), "business_id": str(business_id), **payload.model_dump()},
    )
    row = result.mappings().one()
    await db.commit()
    return Gstr1ExportOut(**row)


@router.get("", response_model=list[Gstr1ExportOut])
async def list_gstr1_exports(
    business_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT id, business_id, period_from, period_to, total_invoices,
                   total_b2b, total_b2c, json_file_path, status, generated_at
            FROM gstr1_exports
            WHERE business_id = :business_id
            ORDER BY generated_at DESC
            """
        ),
        {"business_id": str(business_id)},
    )
    rows = result.mappings().all()
    return [Gstr1ExportOut(**row) for row in rows]

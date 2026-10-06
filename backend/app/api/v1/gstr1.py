"""
GSTR-1 export endpoint (SVCGSTR).

Per the architecture: GSTR-1 JSON is generated ON-DEVICE
(mobile/src/gstr1/generateGstr1.ts), fully offline. This backend endpoint
only STORES the already-generated export as an audit record when the
device later syncs — it does not regenerate the JSON.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db  # TODO: confirm with Member 1
from app.core.security import get_current_business_id  # TODO: confirm with Member 2

router = APIRouter(prefix="/gstr1", tags=["gstr1"])


class Gstr1ExportIn(BaseModel):
    period_from: date
    period_to: date
    total_invoices: int
    total_b2b: int
    total_b2c: int
    json_file_path: str  # wherever the synced JSON blob/file ends up server-side
    status: str = "generated"


class Gstr1ExportOut(Gstr1ExportIn):
    id: UUID
    generated_at: str


@router.post("", response_model=Gstr1ExportOut)
def record_gstr1_export(
    payload: Gstr1ExportIn,
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    """Audit-record a GSTR-1 export the device already generated offline."""
    row = db.execute(
        text(
            """
            INSERT INTO gstr1_exports
                (business_id, period_from, period_to, total_invoices,
                 total_b2b, total_b2c, json_file_path, status)
            VALUES
                (:business_id, :period_from, :period_to, :total_invoices,
                 :total_b2b, :total_b2c, :json_file_path, :status)
            RETURNING id, business_id, period_from, period_to,
                      total_invoices, total_b2b, total_b2c,
                      json_file_path, status, generated_at
            """
        ),
        {"business_id": str(business_id), **payload.model_dump()},
    ).mappings().one()
    db.commit()
    return Gstr1ExportOut(**row)


@router.get("", response_model=list[Gstr1ExportOut])
def list_gstr1_exports(
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    rows = db.execute(
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
    ).mappings().all()
    return [Gstr1ExportOut(**row) for row in rows]

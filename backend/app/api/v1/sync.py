import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.schemas.sync import (
    SyncPushRequest,
    SyncBatchResult,
    SyncPullResponse,
)
from app.services.sync_reconciler import SyncReconciler, MODEL_MAP
from app.models.entities import Invoice, InvoiceItem, Payment

router = APIRouter()
reconciler = SyncReconciler()

@router.post("/push", response_model=SyncBatchResult, status_code=status.HTTP_200_OK)
async def push_sync(
    request: SyncPushRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests batched mutation operations from mobile clients and reconciles
    against PostgreSQL with per-item savepoint isolation.
    """
    return await reconciler.reconcile_batch(db, request.items)

@router.get("/pull", response_model=SyncPullResponse, status_code=status.HTTP_200_OK)
async def pull_sync(
    business_id: uuid.UUID = Query(..., description="Target business UUID"),
    since: Optional[datetime] = Query(None, description="ISO timestamp for delta filtering"),
    db: AsyncSession = Depends(get_db)
):
    """
    Pulls changes created on server or other devices since the specified timestamp.
    """
    server_now = datetime.now(timezone.utc)
    changes = {}

    for entity_name, model in MODEL_MAP.items():
        if entity_name == "businesses":
            stmt = select(model).where(model.id == business_id)
        elif hasattr(model, "business_id"):
            stmt = select(model).where(model.business_id == business_id)
        elif hasattr(model, "invoice_id"):
            # Child records linked to Invoice (e.g., invoice_items, payments)
            stmt = (
                select(model)
                .join(Invoice, model.invoice_id == Invoice.id)
                .where(Invoice.business_id == business_id)
            )
        else:
            # Fallback if no direct link exists
            stmt = select(model)

        if since and hasattr(model, "created_at"):
            stmt = stmt.where(model.created_at > since)

        result = await db.execute(stmt)
        records = result.scalars().all()

        serialized_rows = []
        for r in records:
            row_dict = {}
            for col in r.__table__.columns:
                val = getattr(r, col.name)
                if isinstance(val, uuid.UUID):
                    row_dict[col.name] = str(val)
                elif isinstance(val, datetime):
                    row_dict[col.name] = val.isoformat()
                elif hasattr(val, "__float__"):
                    row_dict[col.name] = float(val)
                else:
                    row_dict[col.name] = val
            serialized_rows.append(row_dict)

        changes[entity_name] = serialized_rows

    return SyncPullResponse(
        server_time=server_now,
        changes=changes
    )

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db_session
from app.schemas.sync import SyncBatchIn, SyncPushResponse
from app.services.sync_reconciler import SyncReconciler

router = APIRouter(prefix="/sync", tags=["Sync"])

@router.post("/push", response_model=SyncPushResponse)
async def push_sync_batch(
    payload: SyncBatchIn,
    db: AsyncSession = Depends(get_db_session),
) -> SyncPushResponse:
    reconciler = SyncReconciler(session=db)
    return await reconciler.reconcile_batch(payload.items)
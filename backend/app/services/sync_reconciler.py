import uuid
import logging
from datetime import date, datetime
from typing import Dict, Any, Type
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.entities import (
    Business,
    Product,
    Customer,
    Invoice,
    InvoiceItem,
    Payment,
    LedgerEntry,
    Expense,
)
from app.schemas.sync import SyncItemIn, SyncPushResponse

logger = logging.getLogger("sync_reconciler")

ENTITY_MODEL_MAP: Dict[str, Type[Any]] = {
    "businesses": Business,
    "products": Product,
    "customers": Customer,
    "invoices": Invoice,
    "invoice_items": InvoiceItem,
    "payments": Payment,
    "ledger_entries": LedgerEntry,
    "expenses": Expense,
}

class SyncReconciler:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def reconcile_batch(self, items: list[SyncItemIn]) -> SyncPushResponse:
        processed_ids: list[int] = []
        failed_ids: list[int] = []

        for item in items:
            try:
                await self._process_item(item)
                await self.session.commit()
                processed_ids.append(item.outbox_id)
            except Exception as e:
                await self.session.rollback()
                logger.error(f"Error syncing item {item.outbox_id} ({item.entity_type}): {e}", exc_info=True)
                failed_ids.append(item.outbox_id)

        return SyncPushResponse(processed_ids=processed_ids, failed_ids=failed_ids)

    async def _process_item(self, item: SyncItemIn) -> None:
        model_cls = ENTITY_MODEL_MAP.get(item.entity_type)
        if not model_cls:
            raise ValueError(f"Unknown entity type: {item.entity_type}")

        entity_uuid = uuid.UUID(item.entity_id) if isinstance(item.entity_id, str) else item.entity_id

        if item.operation == "DELETE":
            await self.session.execute(
                delete(model_cls).where(model_cls.id == entity_uuid)
            )
            return

        clean_data = self._clean_data(model_cls, item.data)
        clean_data["id"] = entity_uuid

        existing = await self.session.get(model_cls, entity_uuid)

        if existing:
            for key, value in clean_data.items():
                setattr(existing, key, value)
        else:
            new_record = model_cls(**clean_data)
            self.session.add(new_record)

    def _clean_data(self, model_cls: Type[Any], data: Dict[str, Any]) -> Dict[str, Any]:
        cleaned: Dict[str, Any] = {}
        columns = model_cls.__table__.columns

        for col_name, column in columns.items():
            if col_name in data:
                val = data[col_name]
                if val is None:
                    cleaned[col_name] = None
                    continue

                col_type = str(column.type).upper()

                # Convert UUID fields (primary key or foreign keys)
                if "UUID" in col_type or col_name.endswith("_id") or col_name == "id":
                    cleaned[col_name] = uuid.UUID(str(val)) if not isinstance(val, uuid.UUID) else val
                # Convert Date fields
                elif "DATE" in col_type and not ("DATETIME" in col_type or "TIMESTAMP" in col_type):
                    cleaned[col_name] = date.fromisoformat(str(val)) if isinstance(val, str) else val
                # Convert Numeric / Decimal
                elif "NUMERIC" in col_type or "DECIMAL" in col_type:
                    cleaned[col_name] = float(val)
                else:
                    cleaned[col_name] = val
        return cleaned

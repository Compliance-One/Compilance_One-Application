import uuid
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
            except Exception:
                await self.session.rollback()
                failed_ids.append(item.outbox_id)

        return SyncPushResponse(processed_ids=processed_ids, failed_ids=failed_ids)

    async def _process_item(self, item: SyncItemIn) -> None:
        model_cls = ENTITY_MODEL_MAP.get(item.entity_type)
        if not model_cls:
            raise ValueError(f"Unknown entity type: {item.entity_type}")

        entity_uuid = uuid.UUID(item.entity_id)

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
        for col_name, column in model_cls.__table__.columns.items():
            if col_name in data:
                val = data[col_name]
                if str(column.type).startswith("UUID") and val is not None:
                    cleaned[col_name] = uuid.UUID(val) if not isinstance(val, uuid.UUID) else val
                else:
                    cleaned[col_name] = val
        return cleaned
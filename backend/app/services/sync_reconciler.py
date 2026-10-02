import uuid
from datetime import datetime, date
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import delete
from app.models.entities import (
    Business,
    Customer,
    Product,
    Invoice,
    InvoiceItem,
    Payment,
    Expense,
    LedgerEntry,
)
from app.schemas.sync import SyncItemIn, SyncBatchResult

MODEL_MAP = {
    "businesses": Business,
    "customers": Customer,
    "products": Product,
    "invoices": Invoice,
    "invoice_items": InvoiceItem,
    "payments": Payment,
    "expenses": Expense,
    "ledger_entries": LedgerEntry,
}

UUID_FIELDS = {
    "id",
    "business_id",
    "customer_id",
    "invoice_id",
    "product_id",
    "payment_id",
    "expense_id",
}

DATE_FIELDS = {
    "invoice_date",
    "payment_date",
    "expense_date",
    "entry_date",
}

TIMESTAMP_FIELDS = {
    "created_at",
    "updated_at",
}

ENTITY_PRIORITY = {
    "businesses": 1,
    "customers": 2,
    "products": 3,
    "invoices": 4,
    "invoice_items": 5,
    "payments": 6,
    "expenses": 7,
    "ledger_entries": 8,
}

class SyncReconciler:
    def _coerce_types(self, data: Dict[str, Any]) -> Dict[str, Any]:
        coerced = {}
        for key, value in data.items():
            if value is None:
                coerced[key] = None
            elif key in UUID_FIELDS and isinstance(value, str):
                coerced[key] = uuid.UUID(value)
            elif key in DATE_FIELDS and isinstance(value, str):
                coerced[key] = date.fromisoformat(value)
            elif key in TIMESTAMP_FIELDS and isinstance(value, str):
                coerced[key] = datetime.fromisoformat(value)
            else:
                coerced[key] = value
        return coerced

    async def reconcile_batch(
        self,
        db: AsyncSession,
        items: List[SyncItemIn]
    ) -> SyncBatchResult:
        def sort_key(item: SyncItemIn) -> int:
            p = ENTITY_PRIORITY.get(item.entity_type, 99)
            return -p if item.operation == "DELETE" else p

        sorted_items = sorted(items, key=sort_key)
        processed_ids: List[int] = []
        failed_ids: List[int] = []

        for item in sorted_items:
            model = MODEL_MAP.get(item.entity_type)
            if not model:
                failed_ids.append(item.outbox_id)
                continue

            try:
                entity_uuid = uuid.UUID(item.entity_id)
            except ValueError:
                failed_ids.append(item.outbox_id)
                continue

            try:
                async with db.begin_nested():
                    if item.operation in ("INSERT", "UPDATE"):
                        raw_data = dict(item.data)
                        raw_data["id"] = entity_uuid
                        payload = self._coerce_types(raw_data)

                        insert_stmt = insert(model).values(**payload)
                        upsert_stmt = insert_stmt.on_conflict_do_update(
                            index_elements=[model.id],
                            set_=payload
                        )
                        await db.execute(upsert_stmt)

                    elif item.operation == "DELETE":
                        del_stmt = delete(model).where(model.id == entity_uuid)
                        await db.execute(del_stmt)

                    else:
                        failed_ids.append(item.outbox_id)
                        continue

                await db.commit()
                processed_ids.append(item.outbox_id)

            except Exception:
                await db.rollback()
                failed_ids.append(item.outbox_id)

        return SyncBatchResult(
            processed_ids=processed_ids,
            failed_ids=failed_ids
        )

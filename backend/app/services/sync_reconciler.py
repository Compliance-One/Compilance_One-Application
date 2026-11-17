import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy import delete, select

from app.models.entities import (
    Business, Customer, Product, Invoice, InvoiceItem, Payment, Expense, LedgerEntry,
    User, Supplier, Purchase, VoiceTransactionLog, Gstr1Export
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
    "users": User,
    "suppliers": Supplier,
    "purchases": Purchase,
    "voice_transaction_logs": VoiceTransactionLog,
    "gstr1_exports": Gstr1Export,
}

UUID_FIELDS = {
    "id", "business_id", "customer_id", "invoice_id", "product_id", "payment_id", 
    "expense_id", "supplier_id", "owner_user_id"
}

DATE_FIELDS = {
    "invoice_date", "payment_date", "expense_date", "entry_date", 
    "purchase_date", "period_from", "period_to"
}

TIMESTAMP_FIELDS = {
    "created_at", "updated_at", "generated_at"
}

ENTITY_PRIORITY = {
    "users": 1,
    "businesses": 2,
    "suppliers": 3,
    "customers": 4,
    "products": 5,
    "purchases": 6,
    "invoices": 7,
    "invoice_items": 8,
    "payments": 9,
    "expenses": 10,
    "ledger_entries": 11,
    "voice_transaction_logs": 12,
    "gstr1_exports": 13,
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


    async def _owned_business_ids(self, db: AsyncSession, user: User) -> Set[uuid.UUID]:
        result = await db.execute(select(Business.id).where(Business.owner_user_id == user.id))
        return {row[0] for row in result.all()}

    async def _collect_allowed_business_ids(
        self, db: AsyncSession, user: User, items: List[SyncItemIn]
    ) -> Set[uuid.UUID]:
        allowed = await self._owned_business_ids(db, user)
        for item in items:
            if item.entity_type != "businesses":
                continue
            try:
                bid = uuid.UUID(item.entity_id)
            except ValueError:
                continue
            existing = await db.get(Business, bid)
            if existing is None or existing.owner_user_id is None or existing.owner_user_id == user.id:
                allowed.add(bid)
        return allowed

    async def _business_id_for_item(
        self, db: AsyncSession, item: SyncItemIn, entity_uuid: uuid.UUID
    ) -> Optional[uuid.UUID]:
        data = item.data or {}
        if item.entity_type == "businesses":
            return entity_uuid
        raw = data.get("business_id")
        if raw:
            try:
                return uuid.UUID(str(raw))
            except ValueError:
                return None
        # Child of invoice (items, payments)
        invoice_id = data.get("invoice_id")
        if not invoice_id and item.entity_type in {"invoice_items", "payments"}:
            invoice_id = entity_uuid  # not the invoice id
        if invoice_id:
            try:
                inv = await db.get(Invoice, uuid.UUID(str(invoice_id)))
            except ValueError:
                inv = None
            if inv is not None:
                return inv.business_id
        return None

    async def reconcile_batch(
        self,
        db: AsyncSession,
        items: List[SyncItemIn],
        user: Optional[User] = None,
    ) -> SyncBatchResult:
        def sort_key(item: SyncItemIn) -> int:
            p = ENTITY_PRIORITY.get(item.entity_type, 99)
            return -p if item.operation == "DELETE" else p

        sorted_items = sorted(items, key=sort_key)
        processed_ids: List[int] = []
        failed_ids: List[int] = []
        allowed_businesses = (
            await self._collect_allowed_business_ids(db, user, items) if user is not None else None
        )

        for item in sorted_items:
            model = MODEL_MAP.get(item.entity_type)
            if not model:
                failed_ids.append(item.outbox_id)
                continue

            # Users are created through /auth, never via the sync outbox.
            if item.entity_type == "users":
                failed_ids.append(item.outbox_id)
                continue

            try:
                entity_uuid = uuid.UUID(item.entity_id)
            except ValueError:
                failed_ids.append(item.outbox_id)
                continue

            if allowed_businesses is not None and user is not None:
                bid = await self._business_id_for_item(db, item, entity_uuid)
                if bid is None or bid not in allowed_businesses:
                    failed_ids.append(item.outbox_id)
                    continue

            try:
                async with db.begin_nested():
                    if item.operation in ("INSERT", "UPDATE"):
                        raw_data = dict(item.data)
                        raw_data["id"] = entity_uuid
                        if item.entity_type == "businesses" and user is not None:
                            raw_data["owner_user_id"] = user.id
                        # Drop columns the model does not have (e.g. mobile-only fields)
                        model_cols = {c.name for c in model.__table__.columns}
                        raw_data = {k: v for k, v in raw_data.items() if k in model_cols}
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

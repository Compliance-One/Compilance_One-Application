import json
import logging
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text, delete, select

from app.models.entities import (
    Business, Customer, Product, Invoice, InvoiceItem, Payment, Expense, LedgerEntry,
    User, Supplier, Purchase, VoiceTransactionLog, Gstr1Export
)
from app.db.types import GUID, JSON
from app.schemas.sync import SyncItemIn, SyncBatchResult

logger = logging.getLogger(__name__)

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

def _parse_datetime(value: str) -> datetime:
    """Parse ISO-8601 / SQLite CURRENT_TIMESTAMP strings ('Z' suffix, space separator, date-only)."""
    text = value.strip()
    if text.endswith(("Z", "z")):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


def _coerce_value(column, value: Any) -> Any:
    """Convert a JSON value sent by the mobile client into the Python type the column needs."""
    if value is None:
        return None
    col_type = column.type
    if isinstance(col_type, GUID):
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
    # DateTime must be checked before Date: neither subclasses the other, but be explicit.
    if isinstance(col_type, DateTime):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            if not value.strip():
                return None
            return _parse_datetime(value)
        return value
    if isinstance(col_type, Date):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            if not value.strip():
                return None
            return _parse_datetime(value).date()
        return value
    if isinstance(col_type, Boolean):
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes", "y"}
        return bool(value)
    if isinstance(col_type, Integer):
        return int(value)
    if isinstance(col_type, Numeric):
        return value if isinstance(value, Decimal) else Decimal(str(value))
    if isinstance(col_type, JSON):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except ValueError:
                return value
        return value
    if isinstance(col_type, (String, Text)) and isinstance(value, str):
        # Mobile may send "" for an empty optional text field; a UNIQUE column such as
        # businesses.gstin must see NULL, not '', or the second blank row would collide.
        if column.name == "gstin" and not value.strip():
            return None
    return value


class SyncReconciler:
    def _coerce_types(self, model, data: Dict[str, Any]) -> Dict[str, Any]:
        columns = model.__table__.columns
        return {key: _coerce_value(columns[key], value) for key, value in data.items() if key in columns}


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
                        payload = self._coerce_types(model, raw_data)

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
                logger.exception(
                    "sync: failed to apply %s %s %s (outbox_id=%s)",
                    item.operation, item.entity_type, item.entity_id, item.outbox_id,
                )
                await db.rollback()
                failed_ids.append(item.outbox_id)

        return SyncBatchResult(
            processed_ids=processed_ids,
            failed_ids=failed_ids
        )

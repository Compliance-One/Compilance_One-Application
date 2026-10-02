import uuid
from datetime import date, datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String, Text, Numeric, Boolean, Date, DateTime, 
    ForeignKey, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), unique=True, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    financial_year_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    voice_language: Mapped[str] = mapped_column(String(10), default="ta-IN")
    offline_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    printer_settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    products: Mapped[List["Product"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    customers: Mapped[List["Customer"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    expenses: Mapped[List["Expense"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    ledger_entries: Mapped[List["LedgerEntry"]] = relationship(back_populates="business", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    unit: Mapped[str] = mapped_column(String(50), default="nos")
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    stock_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    business: Mapped["Business"] = relationship(back_populates="products")
    invoice_items: Mapped[List["InvoiceItem"]] = relationship(back_populates="product")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    customer_type: Mapped[str] = mapped_column(String(10), default="B2C")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint("customer_type IN ('B2B', 'B2C')", name="check_customer_type"),
    )

    business: Mapped["Business"] = relationship(back_populates="customers")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="customer")
    ledger_entries: Mapped[List["LedgerEntry"]] = relationship(back_populates="customer")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(10), default="B2C")
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    taxable_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="UNPAID")
    input_mode: Mapped[str] = mapped_column(String(20), default="voice")
    sync_status: Mapped[str] = mapped_column(String(20), default="synced")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint("invoice_type IN ('B2B', 'B2C')", name="check_invoice_type"),
        CheckConstraint("payment_status IN ('PAID', 'UNPAID', 'PARTIAL')", name="check_invoice_payment_status"),
        CheckConstraint("input_mode IN ('voice', 'text')", name="check_invoice_input_mode"),
    )

    business: Mapped["Business"] = relationship(back_populates="invoices")
    customer: Mapped["Customer"] = relationship(back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    ledger_entries: Mapped[List["LedgerEntry"]] = relationship(back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    taxable_value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="invoice_items")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(50), default="CASH")
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")
    ledger_entries: Mapped[List["LedgerEntry"]] = relationship(back_populates="payment")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)
    debit: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    credit: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)

    business: Mapped["Business"] = relationship(back_populates="ledger_entries")
    customer: Mapped["Customer"] = relationship(back_populates="ledger_entries")
    invoice: Mapped[Optional["Invoice"]] = relationship(back_populates="ledger_entries")
    payment: Mapped[Optional["Payment"]] = relationship(back_populates="ledger_entries")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    business: Mapped["Business"] = relationship(back_populates="expenses")

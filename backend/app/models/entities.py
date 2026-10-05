import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, UniqueConstraint, String, Numeric, Boolean, Date, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Business(Base):
    __tablename__ = "businesses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    business_name = Column(String, nullable=False)
    gstin = Column(String, unique=True, nullable=False)
    address = Column(Text)
    phone = Column(String)
    financial_year_start = Column(Date)
    voice_language = Column(String, default="ta-IN")
    offline_mode = Column(Boolean, default=True)
    printer_settings = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    name = Column(String, nullable=False)
    hsn_code = Column(String)
    gst_rate = Column(Numeric)
    unit = Column(String)
    price = Column(Numeric)
    stock_quantity = Column(Numeric, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    name = Column(String, nullable=False)
    phone = Column(String)
    address = Column(Text)
    gstin = Column(String, nullable=True)
    customer_type = Column(String, default="B2C")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    invoice_number = Column(String, nullable=False)
    invoice_date = Column(Date)
    invoice_type = Column(String, default="B2C")
    subtotal = Column(Numeric)
    discount = Column(Numeric, default=0)
    taxable_amount = Column(Numeric)
    cgst_amount = Column(Numeric, default=0)
    sgst_amount = Column(Numeric, default=0)
    igst_amount = Column(Numeric, default=0)
    total_amount = Column(Numeric)
    payment_status = Column(String, default="unpaid")
    input_mode = Column(String, default="text")
    sync_status = Column(String, default="synced")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint("business_id", "invoice_number", name="uix_business_id_invoice_number"),
    )

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Numeric)
    unit_price = Column(Numeric)
    hsn_code = Column(String)
    gst_rate = Column(Numeric)
    discount = Column(Numeric, default=0)
    taxable_value = Column(Numeric)
    cgst_amount = Column(Numeric, default=0)
    sgst_amount = Column(Numeric, default=0)
    igst_amount = Column(Numeric, default=0)
    line_total = Column(Numeric)

class Payment(Base):
    __tablename__ = "payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    amount = Column(Numeric, nullable=False)
    payment_mode = Column(String, default="cash")
    payment_date = Column(Date)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)
    debit = Column(Numeric, default=0)
    credit = Column(Numeric, default=0)
    description = Column(Text, nullable=True)
    entry_date = Column(Date)

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    category = Column(String)
    description = Column(Text)
    amount = Column(Numeric, nullable=False)
    expense_date = Column(Date)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    name = Column(String)
    gstin = Column(String, nullable=True)
    phone = Column(String)
    address = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    bill_number = Column(String)
    purchase_date = Column(Date)
    amount = Column(Numeric)
    payment_status = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class VoiceTransactionLog(Base):
    __tablename__ = "voice_transaction_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    raw_transcript = Column(Text)
    parsed_json = Column(JSONB)
    language = Column(String)
    input_mode = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Gstr1Export(Base):
    __tablename__ = "gstr1_exports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    period_from = Column(Date)
    period_to = Column(Date)
    total_invoices = Column(Integer)
    total_b2b = Column(Integer)
    total_b2c = Column(Integer)
    json_file_path = Column(Text)
    status = Column(String)
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primaryKey=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Business(Base):
    __tablename__ = "businesses"
    id = Column(String, primaryKey=True, index=True)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    business_name = Column(String, nullable=False)
    gstin = Column(String, unique=True, index=True)
    address = Column(String)
    phone = Column(String)
    state_code = Column(String)
    financial_year_start = Column(String)
    voice_language = Column(String, default="ta")
    offline_mode = Column(Boolean, default=True)
    printer_settings = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primaryKey=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    hsn_code = Column(String, nullable=False)
    gst_rate = Column(Float, nullable=False)
    unit = Column(String, default="PCS")
    price = Column(Float, default=0.0)
    stock_quantity = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primaryKey=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String)
    address = Column(String)
    gstin = Column(String)
    customer_type = Column(String, default="B2C")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String, primaryKey=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"))
    invoice_number = Column(String, nullable=False)
    invoice_date = Column(String, nullable=False)
    invoice_type = Column(String, default="B2C")
    subtotal = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    taxable_amount = Column(Float, default=0.0)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    total_tax = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    payment_status = Column(String, default="unpaid")
    notes = Column(String)
    voice_log_id = Column(String)
    is_gstr1_filed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(String, primaryKey=True, index=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"))
    product_name = Column(String, nullable=False)
    hsn_code = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="PCS")
    rate = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    taxable_amount = Column(Float, nullable=False)
    gst_rate = Column(Float, nullable=False)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primaryKey=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(String, nullable=False)
    payment_mode = Column(String, default="cash")
    reference = Column(String)
    notes = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SyncLog(Base):
    """Tracks the last sync time for a business/device."""
    __tablename__ = "sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False)
    device_id = Column(String, nullable=False)
    last_pulled_at = Column(DateTime(timezone=True))
    last_pushed_at = Column(DateTime(timezone=True))

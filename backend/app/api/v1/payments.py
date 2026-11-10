"""
Payments and Receipts API Router for Compliance One.
Records customer receipts, links payments to invoices, updates invoice payment status,
and provides collection reports.
"""

from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.v1.invoices import _INVOICES_DB, InvoiceStatusEnum

router = APIRouter(prefix="/payments", tags=["Payments & Receipts"])


class PaymentModeEnum(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    NEFT_RTGS = "NEFT_RTGS"
    CHEQUE = "CHEQUE"
    CARD = "CARD"


class PaymentCreate(BaseModel):
    invoice_id: Optional[str] = Field(None, example="inv_101")
    customer_name: str = Field(..., example="Shree Balaji Enterprises")
    amount: float = Field(..., gt=0, example=50000.0)
    payment_mode: PaymentModeEnum = Field(default=PaymentModeEnum.UPI, example=PaymentModeEnum.UPI)
    transaction_reference: Optional[str] = Field(
        None, example="UPI/1234567890/HDFC or Cheque No. 441021"
    )
    payment_date: Optional[date] = Field(default_factory=date.today)
    notes: Optional[str] = Field(None, example="Advance payment for order #APX-26/0147")


class PaymentResponse(BaseModel):
    id: str
    receipt_number: str
    invoice_id: Optional[str]
    customer_name: str
    amount: float
    payment_mode: PaymentModeEnum
    transaction_reference: Optional[str]
    payment_date: str
    notes: Optional[str]
    created_at: str


class DailyCollectionSummary(BaseModel):
    date: str
    total_collected: float
    total_transactions: int
    by_mode: Dict[str, float]


# In-memory payment ledger
_PAYMENTS_DB: Dict[str, Dict[str, Any]] = {
    "pay_001": {
        "id": "pay_001",
        "receipt_number": "REC-26/001",
        "invoice_id": "inv_101",
        "customer_name": "Shree Balaji Enterprises",
        "amount": 147500.0,
        "payment_mode": PaymentModeEnum.NEFT_RTGS.value,
        "transaction_reference": "NEFT-HDFC26110800142",
        "payment_date": "2026-11-08",
        "notes": "Full settlement for invoice APX-26/0147",
        "created_at": "2026-11-08T11:00:00Z",
    }
}


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED, summary="Record payment receipt")
def record_payment(payload: PaymentCreate):
    """
    Records a payment receipt. If linked to an invoice, auto-updates invoice `paid_amount`,
    `balance_due`, and switches status to PARTIAL or PAID.
    """
    receipt_no = f"REC-26/{len(_PAYMENTS_DB) + 1:03d}"
    pay_id = f"pay_{len(_PAYMENTS_DB) + 1:03d}"

    # If linked to an invoice, reconcile balance
    if payload.invoice_id:
        inv = _INVOICES_DB.get(payload.invoice_id)
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice '{payload.invoice_id}' not found.",
            )

        if inv["status"] == InvoiceStatusEnum.CANCELLED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot accept payment for a cancelled invoice.",
            )

        inv["paid_amount"] = round(inv["paid_amount"] + payload.amount, 2)
        inv["balance_due"] = max(0.0, round(inv["grand_total"] - inv["paid_amount"], 2))

        if inv["balance_due"] == 0:
            inv["status"] = InvoiceStatusEnum.PAID.value
        else:
            inv["status"] = InvoiceStatusEnum.PARTIAL.value

    new_payment = {
        "id": pay_id,
        "receipt_number": receipt_no,
        "invoice_id": payload.invoice_id,
        "customer_name": payload.customer_name,
        "amount": payload.amount,
        "payment_mode": payload.payment_mode.value,
        "transaction_reference": payload.transaction_reference,
        "payment_date": str(payload.payment_date or date.today()),
        "notes": payload.notes,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    _PAYMENTS_DB[pay_id] = new_payment
    return new_payment


@router.get("", response_model=List[PaymentResponse], summary="List payment transactions")
def list_payments(
    invoice_id: Optional[str] = Query(None),
    payment_mode: Optional[PaymentModeEnum] = Query(None),
    customer_name: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    results = list(_PAYMENTS_DB.values())

    if invoice_id:
        results = [p for p in results if p.get("invoice_id") == invoice_id]

    if payment_mode:
        results = [p for p in results if p["payment_mode"] == payment_mode.value]

    if customer_name:
        q = customer_name.lower().strip()
        results = [p for p in results if q in p["customer_name"].lower()]

    if date_from:
        results = [p for p in results if p["payment_date"] >= date_from.isoformat()]

    if date_to:
        results = [p for p in results if p["payment_date"] <= date_to.isoformat()]

    return results


@router.get("/{payment_id}", response_model=PaymentResponse, summary="Get payment receipt")
def get_payment(payment_id: str):
    pay = _PAYMENTS_DB.get(payment_id)
    if not pay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")
    return pay


@router.get("/summary/daily", response_model=DailyCollectionSummary, summary="Daily collection metrics")
def get_daily_collection_summary(summary_date: Optional[date] = Query(default_factory=date.today)):
    target_date = str(summary_date)
    matching = [p for p in _PAYMENTS_DB.values() if p["payment_date"] == target_date]

    total = sum(p["amount"] for p in matching)
    by_mode: Dict[str, float] = {}

    for p in matching:
        mode = p["payment_mode"]
        by_mode[mode] = by_mode.get(mode, 0.0) + p["amount"]

    return DailyCollectionSummary(
        date=target_date,
        total_collected=total,
        total_transactions=len(matching),
        by_mode=by_mode,
    )


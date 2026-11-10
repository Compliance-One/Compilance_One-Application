"""
Operational Expenses & Input Tax Credit (ITC) API Router.
Tracks business expenditures, vendor tax receipts, and calculates GST Input Tax Credit claims.
"""

from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/expenses", tags=["Business Expenses"])


class ExpenseCategoryEnum(str, Enum):
    RENT = "RENT"
    UTILITIES = "UTILITIES"
    SALARIES = "SALARIES"
    OFFICE_SUPPLIES = "OFFICE_SUPPLIES"
    TRAVEL = "TRAVEL"
    LOGISTICS_FREIGHT = "LOGISTICS_FREIGHT"
    MAINTENANCE = "MAINTENANCE"
    RAW_MATERIALS = "RAW_MATERIALS"
    TAXES_FEES = "TAXES_FEES"
    MISCELLANEOUS = "MISCELLANEOUS"


class ExpensePaymentMode(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    BANK_TRANSFER = "BANK_TRANSFER"
    CARD = "CARD"
    CHEQUE = "CHEQUE"


class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=2, example="Godown Warehouse Rent - Nov 2026")
    category: ExpenseCategoryEnum = Field(default=ExpenseCategoryEnum.RENT)
    amount: float = Field(..., gt=0, example=45000.0)
    vendor_name: Optional[str] = Field(None, example="Industrial Real Estate Corp")
    vendor_gstin: Optional[str] = Field(None, min_length=15, max_length=15, example="27AAACR1234F1Z8")
    tax_rate: float = Field(default=18.0, ge=0, example=18.0)
    is_itc_eligible: bool = Field(
        default=True,
        description="Whether Input Tax Credit (ITC) can be claimed under GST Section 16",
    )
    payment_mode: ExpensePaymentMode = Field(default=ExpensePaymentMode.BANK_TRANSFER)
    expense_date: Optional[date] = Field(default_factory=date.today)
    receipt_reference: Optional[str] = Field(None, example="BILL/2026/982")
    notes: Optional[str] = Field(None, example="Monthly lease payment")


class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[ExpenseCategoryEnum] = None
    amount: Optional[float] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    tax_rate: Optional[float] = None
    is_itc_eligible: Optional[bool] = None
    payment_mode: Optional[ExpensePaymentMode] = None
    expense_date: Optional[date] = None
    receipt_reference: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: str
    title: str
    category: ExpenseCategoryEnum
    amount: float
    taxable_amount: float
    gst_amount: float
    itc_amount: float
    vendor_name: Optional[str]
    vendor_gstin: Optional[str]
    tax_rate: float
    is_itc_eligible: bool
    payment_mode: ExpensePaymentMode
    expense_date: str
    receipt_reference: Optional[str]
    notes: Optional[str]
    created_at: str


class ExpenseAnalyticsSummary(BaseModel):
    total_expenses: float
    total_gst_paid: float
    total_itc_claimable: float
    by_category: Dict[str, float]
    count: int


# In-memory expenses store
_EXPENSES_DB: Dict[str, Dict[str, Any]] = {
    "exp_001": {
        "id": "exp_001",
        "title": "Godown Warehouse Rent - Nov 2026",
        "category": ExpenseCategoryEnum.RENT.value,
        "amount": 53100.0,
        "taxable_amount": 45000.0,
        "gst_amount": 8100.0,
        "itc_amount": 8100.0,
        "vendor_name": "Industrial Real Estate Corp",
        "vendor_gstin": "27AAACR1234F1Z8",
        "tax_rate": 18.0,
        "is_itc_eligible": True,
        "payment_mode": ExpensePaymentMode.BANK_TRANSFER.value,
        "expense_date": "2026-11-01",
        "receipt_reference": "INV-RENT-1102",
        "notes": "Monthly godown lease paid via RTGS",
        "created_at": "2026-11-01T10:00:00Z",
    },
    "exp_002": {
        "id": "exp_002",
        "title": "Office High-Speed Internet & Fiber",
        "category": ExpenseCategoryEnum.UTILITIES.value,
        "amount": 2360.0,
        "taxable_amount": 2000.0,
        "gst_amount": 360.0,
        "itc_amount": 360.0,
        "vendor_name": "Tata Telecommunications Ltd",
        "vendor_gstin": "27AAACT9900K1ZP",
        "tax_rate": 18.0,
        "is_itc_eligible": True,
        "payment_mode": ExpensePaymentMode.UPI.value,
        "expense_date": "2026-11-05",
        "receipt_reference": "TT-BILL-88219",
        "notes": "Paid by billing staff via UPI",
        "created_at": "2026-11-05T14:30:00Z",
    },
}


def _calculate_expense_breakdown(gross_amount: float, tax_rate: float, is_itc: bool):
    """Calculates reverse taxable amount and tax from gross amount."""
    if tax_rate <= 0:
        return gross_amount, 0.0, 0.0

    taxable = round(gross_amount / (1 + (tax_rate / 100)), 2)
    gst = round(gross_amount - taxable, 2)
    itc = gst if is_itc else 0.0
    return taxable, gst, itc


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED, summary="Log operational expense")
def create_expense(payload: ExpenseCreate):
    exp_id = f"exp_{len(_EXPENSES_DB) + 1:03d}"
    taxable, gst, itc = _calculate_expense_breakdown(
        gross_amount=payload.amount,
        tax_rate=payload.tax_rate,
        is_itc=payload.is_itc_eligible and bool(payload.vendor_gstin),
    )

    new_expense = {
        "id": exp_id,
        "title": payload.title,
        "category": payload.category.value,
        "amount": payload.amount,
        "taxable_amount": taxable,
        "gst_amount": gst,
        "itc_amount": itc,
        "vendor_name": payload.vendor_name,
        "vendor_gstin": payload.vendor_gstin.upper() if payload.vendor_gstin else None,
        "tax_rate": payload.tax_rate,
        "is_itc_eligible": payload.is_itc_eligible,
        "payment_mode": payload.payment_mode.value,
        "expense_date": str(payload.expense_date or date.today()),
        "receipt_reference": payload.receipt_reference,
        "notes": payload.notes,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    _EXPENSES_DB[exp_id] = new_expense
    return new_expense


@router.get("", response_model=List[ExpenseResponse], summary="List business expenses with filters")
def list_expenses(
    category: Optional[ExpenseCategoryEnum] = Query(None),
    is_itc_eligible: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Search by title or vendor"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    results = list(_EXPENSES_DB.values())

    if category:
        results = [e for e in results if e["category"] == category.value]

    if is_itc_eligible is not None:
        results = [e for e in results if e["is_itc_eligible"] == is_itc_eligible]

    if search:
        q = search.lower().strip()
        results = [
            e
            for e in results
            if q in e["title"].lower() or (e.get("vendor_name") and q in e["vendor_name"].lower())
        ]

    if date_from:
        results = [e for e in results if e["expense_date"] >= date_from.isoformat()]

    if date_to:
        results = [e for e in results if e["expense_date"] <= date_to.isoformat()]

    return results


@router.get("/{expense_id}", response_model=ExpenseResponse, summary="Get expense details")
def get_expense(expense_id: str):
    exp = _EXPENSES_DB.get(expense_id)
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found")
    return exp


@router.put("/{expense_id}", response_model=ExpenseResponse, summary="Update expense")
def update_expense(expense_id: str, payload: ExpenseUpdate):
    exp = _EXPENSES_DB.get(expense_id)
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found")

    update_dict = payload.model_dump(exclude_unset=True)

    if "category" in update_dict:
        update_dict["category"] = update_dict["category"].value
    if "payment_mode" in update_dict:
        update_dict["payment_mode"] = update_dict["payment_mode"].value
    if "expense_date" in update_dict:
        update_dict["expense_date"] = str(update_dict["expense_date"])
    if "vendor_gstin" in update_dict and update_dict["vendor_gstin"]:
        update_dict["vendor_gstin"] = update_dict["vendor_gstin"].upper()

    exp.update(update_dict)

    # Recompute tax breakdowns
    taxable, gst, itc = _calculate_expense_breakdown(
        gross_amount=exp["amount"],
        tax_rate=exp["tax_rate"],
        is_itc=exp["is_itc_eligible"] and bool(exp.get("vendor_gstin")),
    )
    exp["taxable_amount"] = taxable
    exp["gst_amount"] = gst
    exp["itc_amount"] = itc

    return exp


@router.delete("/{expense_id}", summary="Delete expense record")
def delete_expense(expense_id: str):
    if expense_id not in _EXPENSES_DB:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found")
    del _EXPENSES_DB[expense_id]
    return {"message": f"Expense '{expense_id}' deleted successfully."}


@router.get("/analytics/summary", response_model=ExpenseAnalyticsSummary, summary="Expense breakdown and ITC report")
def get_expense_analytics():
    total_exp = sum(e["amount"] for e in _EXPENSES_DB.values())
    total_gst = sum(e["gst_amount"] for e in _EXPENSES_DB.values())
    total_itc = sum(e["itc_amount"] for e in _EXPENSES_DB.values())

    by_cat: Dict[str, float] = {}
    for e in _EXPENSES_DB.values():
        cat = e["category"]
        by_cat[cat] = by_cat.get(cat, 0.0) + e["amount"]

    return ExpenseAnalyticsSummary(
        total_expenses=round(total_exp, 2),
        total_gst_paid=round(total_gst, 2),
        total_itc_claimable=round(total_itc, 2),
        by_category=by_cat,
        count=len(_EXPENSES_DB),
    )


"""
Invoices API Router for Compliance One.
Integrates with gst_calculator to automatically compute CGST/SGST/IGST, line totals,
and stock decrements.
"""

from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.services.gst_calculator import (
    calculate_gst,
    calculate_invoice_totals,
    normalize_state_code,
    GST_STATE_CODES,
)
from app.api.v1.business import _CURRENT_BUSINESS
from app.api.v1.products import _PRODUCTS_DB

router = APIRouter(prefix="/invoices", tags=["Invoices & Billing"])


class InvoiceStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class CustomerInfoSchema(BaseModel):
    name: str = Field(..., example="Bharat Industrial Supplies LLP")
    gstin: Optional[str] = Field(None, example="27AABCB9876Q1ZB")
    phone: Optional[str] = Field(None, example="+91 98220 12345")
    email: Optional[str] = Field(None, example="accounts@bharatsupplies.com")
    billing_address: str = Field(..., example="Gala 102, Shanti Industrial Estate, Thane West")
    state_code: str = Field(..., example="27")


class InvoiceItemInput(BaseModel):
    product_id: Optional[str] = Field(None, example="prod_1")
    name: str = Field(..., example="Heavy Duty Industrial Ball Valve 2 Inch")
    hsn_code: str = Field(..., example="84818030")
    quantity: int = Field(..., gt=0, example=10)
    unit: str = Field(default="PCS", example="PCS")
    unit_price: float = Field(..., gt=0, example=1250.0)
    discount_percent: float = Field(default=0.0, ge=0, le=100, example=5.0)
    tax_rate: float = Field(..., example=18.0)


class InvoiceItemResponse(InvoiceItemInput):
    gross_amount: float
    discount_amount: float
    taxable_amount: float
    cgst_rate: float
    cgst_amount: float
    sgst_rate: float
    sgst_amount: float
    igst_rate: float
    igst_amount: float
    total_tax_amount: float
    total_amount: float


class InvoiceCreate(BaseModel):
    customer: CustomerInfoSchema
    items: List[InvoiceItemInput] = Field(..., min_length=1)
    invoice_date: Optional[date] = Field(default_factory=date.today)
    due_date: Optional[date] = None
    payment_terms: str = Field(default="Net 15 Days", example="Net 15 Days")
    notes: Optional[str] = Field(
        default="Subject to local jurisdiction. Goods once sold will not be taken back."
    )


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    status: InvoiceStatusEnum
    seller_legal_name: str
    seller_gstin: str
    seller_state_code: str
    place_of_supply: str
    is_inter_state: bool
    customer: CustomerInfoSchema
    items: List[InvoiceItemResponse]
    taxable_subtotal: float
    total_cgst: float
    total_sgst: float
    total_igst: float
    total_tax: float
    round_off: float
    grand_total: float
    paid_amount: float
    balance_due: float
    invoice_date: str
    due_date: Optional[str]
    notes: Optional[str]
    created_at: str


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatusEnum
    notes: Optional[str] = None


# Mock in-memory database of invoices
_INVOICES_DB: Dict[str, Dict[str, Any]] = {
    "inv_101": {
        "id": "inv_101",
        "invoice_number": "APX-26/0147",
        "status": "PAID",
        "seller_legal_name": "Apex Enterprise Private Limited",
        "seller_gstin": "27AABCA1234F1Z5",
        "seller_state_code": "27",
        "place_of_supply": "27 - Maharashtra",
        "is_inter_state": False,
        "customer": {
            "name": "Shree Balaji Enterprises",
            "gstin": "27AAECB9123F1ZV",
            "phone": "+91 98220 99887",
            "email": "balaji@gmail.com",
            "billing_address": "Shop 12, Market Yard, Pune, MH - 411037",
            "state_code": "27",
        },
        "items": [
            {
                "product_id": "prod_1",
                "name": "Heavy Duty Industrial Ball Valve 2 Inch",
                "hsn_code": "84818030",
                "quantity": 100,
                "unit": "PCS",
                "unit_price": 1250.0,
                "discount_percent": 0.0,
                "gross_amount": 125000.0,
                "discount_amount": 0.0,
                "taxable_amount": 125000.0,
                "cgst_rate": 9.0,
                "cgst_amount": 11250.0,
                "sgst_rate": 9.0,
                "sgst_amount": 11250.0,
                "igst_rate": 0.0,
                "igst_amount": 0.0,
                "total_tax_amount": 22500.0,
                "total_amount": 147500.0,
            }
        ],
        "taxable_subtotal": 125000.0,
        "total_cgst": 11250.0,
        "total_sgst": 11250.0,
        "total_igst": 0.0,
        "total_tax": 22500.0,
        "round_off": 0.0,
        "grand_total": 147500.0,
        "paid_amount": 147500.0,
        "balance_due": 0.0,
        "invoice_date": "2026-11-08",
        "due_date": "2026-11-23",
        "notes": "Full payment received via NEFT.",
        "created_at": "2026-11-08T10:00:00Z",
    }
}


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED, summary="Create tax invoice")
def create_invoice(payload: InvoiceCreate):
    """
    Creates a tax invoice compliant with Indian GST laws:
    - Calculates CGST/SGST (intra-state) or IGST (inter-state) via `calculate_gst`
    - Computes Round-Off to nearest whole rupee
    - Updates product inventory stock
    """
    seller_state_code = normalize_state_code(_CURRENT_BUSINESS.get("state_code", "27"))
    buyer_state_code = normalize_state_code(payload.customer.state_code)
    is_inter_state = seller_state_code != buyer_state_code

    processed_items: List[Dict[str, Any]] = []

    for item in payload.items:
        # Check stock if product_id is associated
        if item.product_id and item.product_id in _PRODUCTS_DB:
            prod = _PRODUCTS_DB[item.product_id]
            if prod["current_stock"] < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient inventory for '{prod['name']}'. Requested: {item.quantity}, In Stock: {prod['current_stock']}",
                )
            # Decrement stock
            prod["current_stock"] -= item.quantity
            prod["updated_at"] = datetime.utcnow().isoformat() + "Z"

        # Calculate GST using central calculation engine
        gst_res = calculate_gst(
            item_price=item.unit_price,
            quantity=item.quantity,
            tax_rate=item.tax_rate,
            seller_state_code=seller_state_code,
            buyer_state_code=buyer_state_code,
            discount_percent=item.discount_percent,
        )

        processed_items.append(
            {
                "product_id": item.product_id,
                "name": item.name,
                "hsn_code": item.hsn_code,
                "quantity": item.quantity,
                "unit": item.unit,
                "unit_price": item.unit_price,
                "discount_percent": item.discount_percent,
                "gross_amount": gst_res.gross_amount,
                "discount_amount": gst_res.discount_amount,
                "taxable_amount": gst_res.taxable_amount,
                "cgst_rate": gst_res.cgst_rate,
                "cgst_amount": gst_res.cgst_amount,
                "sgst_rate": gst_res.sgst_rate,
                "sgst_amount": gst_res.sgst_amount,
                "igst_rate": gst_res.igst_rate,
                "igst_amount": gst_res.igst_amount,
                "total_tax_amount": gst_res.total_tax_amount,
                "total_amount": gst_res.total_amount,
            }
        )

    # Calculate overall totals
    totals = calculate_invoice_totals(
        items=processed_items,
        seller_state_code=seller_state_code,
        buyer_state_code=buyer_state_code,
    )

    inv_counter = len(_INVOICES_DB) + 148
    invoice_number = f"{_CURRENT_BUSINESS.get('invoice_prefix', 'APX-26/')}{inv_counter:04d}"
    inv_id = f"inv_{len(_INVOICES_DB) + 102}"

    new_invoice = {
        "id": inv_id,
        "invoice_number": invoice_number,
        "status": InvoiceStatusEnum.ISSUED.value,
        "seller_legal_name": _CURRENT_BUSINESS.get("legal_name", "Apex Enterprise Pvt Ltd"),
        "seller_gstin": _CURRENT_BUSINESS.get("gstin", "27AABCA1234F1Z5"),
        "seller_state_code": seller_state_code,
        "place_of_supply": f"{buyer_state_code} - {GST_STATE_CODES.get(buyer_state_code, 'Other')}",
        "is_inter_state": is_inter_state,
        "customer": payload.customer.model_dump(),
        "items": processed_items,
        "taxable_subtotal": totals.total_taxable_amount,
        "total_cgst": totals.total_cgst_amount,
        "total_sgst": totals.total_sgst_amount,
        "total_igst": totals.total_igst_amount,
        "total_tax": totals.total_tax_amount,
        "round_off": totals.round_off,
        "grand_total": totals.grand_total,
        "paid_amount": 0.0,
        "balance_due": totals.grand_total,
        "invoice_date": payload.invoice_date.isoformat() if payload.invoice_date else str(date.today()),
        "due_date": payload.due_date.isoformat() if payload.due_date else None,
        "notes": payload.notes,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    _INVOICES_DB[inv_id] = new_invoice
    return new_invoice


@router.get("", response_model=List[InvoiceResponse], summary="List invoices with filters")
def list_invoices(
    status_filter: Optional[InvoiceStatusEnum] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Search by customer name or invoice number"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    results = list(_INVOICES_DB.values())

    if status_filter:
        results = [inv for inv in results if inv["status"] == status_filter.value]

    if search:
        q = search.lower().strip()
        results = [
            inv
            for inv in results
            if q in inv["invoice_number"].lower()
            or q in inv["customer"]["name"].lower()
            or (inv["customer"].get("gstin") and q in inv["customer"]["gstin"].lower())
        ]

    if date_from:
        results = [inv for inv in results if inv["invoice_date"] >= date_from.isoformat()]

    if date_to:
        results = [inv for inv in results if inv["invoice_date"] <= date_to.isoformat()]

    return results


@router.get("/{invoice_id}", response_model=InvoiceResponse, summary="Get invoice details")
def get_invoice(invoice_id: str):
    inv = _INVOICES_DB.get(invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return inv


@router.patch("/{invoice_id}/status", response_model=InvoiceResponse, summary="Update invoice status")
def update_invoice_status(invoice_id: str, payload: InvoiceStatusUpdate):
    inv = _INVOICES_DB.get(invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    inv["status"] = payload.status.value
    if payload.notes:
        inv["notes"] = f"{inv.get('notes', '')}\n[Status Change]: {payload.notes}".strip()

    if payload.status == InvoiceStatusEnum.PAID:
        inv["paid_amount"] = inv["grand_total"]
        inv["balance_due"] = 0.0

    return inv


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse, summary="Cancel invoice and restock items")
def cancel_invoice(invoice_id: str, reason: str = Query("Customer request")):
    inv = _INVOICES_DB.get(invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if inv["status"] == InvoiceStatusEnum.CANCELLED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice is already cancelled."
        )

    # Restock inventory items
    for item in inv.get("items", []):
        p_id = item.get("product_id")
        if p_id and p_id in _PRODUCTS_DB:
            _PRODUCTS_DB[p_id]["current_stock"] += item["quantity"]

    inv["status"] = InvoiceStatusEnum.CANCELLED.value
    inv["balance_due"] = 0.0
    inv["notes"] = f"{inv.get('notes', '')}\n[CANCELLED]: {reason}".strip()

    return inv


"""
Suppliers & Vendor Master Data API Router for Compliance One.
Manages vendor profiles, GSTINs, state codes, bank information, and payable ledgers.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.services.gst_calculator import GST_STATE_CODES, normalize_state_code

router = APIRouter(prefix="/suppliers", tags=["Suppliers & Vendors"])


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, example="Larsen & Toubro Electrical Ltd")
    contact_person: Optional[str] = Field(None, example="Mr. Sanjeev Kapoor")
    gstin: Optional[str] = Field(None, min_length=15, max_length=15, example="27AAACL1234F1Z9")
    pan: Optional[str] = Field(None, min_length=10, max_length=10, example="AAACL1234F")
    state_code: str = Field(default="27", example="27")
    phone: str = Field(..., example="+91 22 6705 1000")
    email: Optional[str] = Field(None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", example="orders@lntelectricals.com")
    address: Optional[str] = Field(
        None, example="L&T House, Ballard Estate, Mumbai, Maharashtra - 400001"
    )
    bank_name: Optional[str] = Field(None, example="State Bank of India")
    account_number: Optional[str] = Field(None, example="30987654321")
    ifsc_code: Optional[str] = Field(None, example="SBIN0000300")
    outstanding_payable: float = Field(default=0.0, ge=0, example=240000.0)
    is_active: bool = Field(default=True)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = Field(None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    address: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    outstanding_payable: Optional[float] = None
    is_active: Optional[bool] = None


class SupplierResponse(SupplierBase):
    id: str
    state_name: str
    created_at: str
    updated_at: str


class SupplierBillResponse(BaseModel):
    bill_number: str
    bill_date: str
    total_amount: float
    tax_amount: float
    status: str


# In-memory supplier registry
_SUPPLIERS_DB: Dict[str, Dict[str, Any]] = {
    "sup_001": {
        "id": "sup_001",
        "name": "Larsen & Toubro Electrical Ltd",
        "contact_person": "Mr. Sanjeev Kapoor",
        "gstin": "27AAACL1234F1Z9",
        "pan": "AAACL1234F",
        "state_code": "27",
        "phone": "+91 22 6705 1000",
        "email": "orders@lntelectricals.com",
        "address": "L&T House, Ballard Estate, Mumbai, MH - 400001",
        "bank_name": "State Bank of India",
        "account_number": "30987654321",
        "ifsc_code": "SBIN0000300",
        "outstanding_payable": 240000.0,
        "is_active": True,
        "created_at": "2026-01-10T10:00:00Z",
        "updated_at": "2026-11-02T12:00:00Z",
    },
    "sup_002": {
        "id": "sup_002",
        "name": "Kirloskar Brothers Pneumatics",
        "contact_person": "Anil Kirloskar",
        "gstin": "27AAACK3344P1Z3",
        "pan": "AAACK3344P",
        "state_code": "27",
        "phone": "+91 20 2568 2000",
        "email": "vendor@kirloskarbrothers.in",
        "address": "Kirloskarvadi, Sangli, MH - 416308",
        "bank_name": "Axis Bank Ltd",
        "account_number": "918020012345678",
        "ifsc_code": "UTIB0000045",
        "outstanding_payable": 85000.0,
        "is_active": True,
        "created_at": "2026-02-14T09:30:00Z",
        "updated_at": "2026-10-28T15:20:00Z",
    },
}

_SUPPLIER_BILLS: Dict[str, List[Dict[str, Any]]] = {
    "sup_001": [
        {
            "bill_number": "LNT-PO-8819",
            "bill_date": "2026-10-25",
            "total_amount": 240000.0,
            "tax_amount": 36610.17,
            "status": "UNPAID",
        }
    ],
    "sup_002": [
        {
            "bill_number": "KIR-2026-041",
            "bill_date": "2026-10-15",
            "total_amount": 85000.0,
            "tax_amount": 12966.10,
            "status": "PARTIAL",
        }
    ],
}


def _to_supplier_response(sup: Dict[str, Any]) -> SupplierResponse:
    state_code = normalize_state_code(sup.get("state_code", "27"))
    state_name = GST_STATE_CODES.get(state_code, "Unknown State")
    return SupplierResponse(
        **sup,
        state_name=state_name,
    )


@router.get("", response_model=List[SupplierResponse], summary="List suppliers with search & filters")
def list_suppliers(
    search: Optional[str] = Query(None, description="Search by name, GSTIN, or contact person"),
    has_outstanding: Optional[bool] = Query(None, description="Filter vendors with pending payables"),
    state_code: Optional[str] = Query(None),
):
    results = [s for s in _SUPPLIERS_DB.values() if s["is_active"]]

    if search:
        q = search.lower().strip()
        results = [
            s
            for s in results
            if q in s["name"].lower()
            or (s.get("gstin") and q in s["gstin"].lower())
            or (s.get("contact_person") and q in s["contact_person"].lower())
        ]

    if has_outstanding is not None:
        results = (
            [s for s in results if s["outstanding_payable"] > 0]
            if has_outstanding
            else [s for s in results if s["outstanding_payable"] == 0]
        )

    if state_code:
        code = normalize_state_code(state_code)
        results = [s for s in results if s["state_code"] == code]

    return [_to_supplier_response(s) for s in results]


@router.get("/{supplier_id}", response_model=SupplierResponse, summary="Get supplier details")
def get_supplier(supplier_id: str):
    sup = _SUPPLIERS_DB.get(supplier_id)
    if not sup or not sup["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return _to_supplier_response(sup)


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED, summary="Create new supplier")
def create_supplier(payload: SupplierCreate):
    sup_id = f"sup_{len(_SUPPLIERS_DB) + 1:03d}"
    state_code = normalize_state_code(payload.state_code)

    gstin = payload.gstin.upper() if payload.gstin else None
    pan = payload.pan.upper() if payload.pan else (gstin[2:12] if gstin and len(gstin) >= 12 else None)
    if gstin and len(gstin) >= 2:
        state_code = normalize_state_code(gstin[:2])

    new_sup = {
        "id": sup_id,
        "name": payload.name,
        "contact_person": payload.contact_person,
        "gstin": gstin,
        "pan": pan,
        "state_code": state_code,
        "phone": payload.phone,
        "email": str(payload.email) if payload.email else None,
        "address": payload.address,
        "bank_name": payload.bank_name,
        "account_number": payload.account_number,
        "ifsc_code": payload.ifsc_code.upper() if payload.ifsc_code else None,
        "outstanding_payable": payload.outstanding_payable,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }

    _SUPPLIERS_DB[sup_id] = new_sup
    return _to_supplier_response(new_sup)


@router.put("/{supplier_id}", response_model=SupplierResponse, summary="Update supplier details")
def update_supplier(supplier_id: str, payload: SupplierUpdate):
    sup = _SUPPLIERS_DB.get(supplier_id)
    if not sup or not sup["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    update_dict = payload.model_dump(exclude_unset=True)

    if "gstin" in update_dict and update_dict["gstin"]:
        update_dict["gstin"] = update_dict["gstin"].upper()
        if len(update_dict["gstin"]) >= 12 and "pan" not in update_dict:
            update_dict["pan"] = update_dict["gstin"][2:12]
        if len(update_dict["gstin"]) >= 2 and "state_code" not in update_dict:
            update_dict["state_code"] = normalize_state_code(update_dict["gstin"][:2])

    if "ifsc_code" in update_dict and update_dict["ifsc_code"]:
        update_dict["ifsc_code"] = update_dict["ifsc_code"].upper()

    if "email" in update_dict and update_dict["email"]:
        update_dict["email"] = str(update_dict["email"])

    sup.update(update_dict)
    sup["updated_at"] = datetime.utcnow().isoformat() + "Z"

    return _to_supplier_response(sup)


@router.delete("/{supplier_id}", summary="Deactivate supplier")
def delete_supplier(supplier_id: str):
    sup = _SUPPLIERS_DB.get(supplier_id)
    if not sup or not sup["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    sup["is_active"] = False
    sup["updated_at"] = datetime.utcnow().isoformat() + "Z"
    return {"message": f"Supplier '{sup['name']}' deactivated successfully."}


@router.get("/{supplier_id}/bills", response_model=List[SupplierBillResponse], summary="List purchase bills for supplier")
def list_supplier_bills(supplier_id: str):
    if supplier_id not in _SUPPLIERS_DB:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return _SUPPLIER_BILLS.get(supplier_id, [])

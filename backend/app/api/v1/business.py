"""
Business Metadata and Profile API Router.
Handles business master info, GSTIN verification, bank account details, and state codes.
"""

from typing import Dict, List, Optional, Any
import re
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.services.gst_calculator import GST_STATE_CODES, normalize_state_code

router = APIRouter(prefix="/business", tags=["Business Profile"])


class AddressSchema(BaseModel):
    street: str = Field(..., example="Plot No. 42, MIDC Industrial Area")
    city: str = Field(..., example="Mumbai")
    state: str = Field(..., example="Maharashtra")
    pincode: str = Field(..., example="400093")


class BankDetailsSchema(BaseModel):
    bank_name: str = Field(..., example="HDFC Bank")
    account_number: str = Field(..., example="50200012345678")
    ifsc_code: str = Field(..., example="HDFC0000240")
    branch_name: str = Field(..., example="Andheri East Branch")
    upi_id: Optional[str] = Field(None, example="apexenterprise@hdfcbank")


class BusinessProfileBase(BaseModel):
    legal_name: str = Field(..., example="Apex Enterprise Private Limited")
    trade_name: Optional[str] = Field(None, example="Apex Tools & Hardware")
    gstin: str = Field(..., min_length=15, max_length=15, example="27AABCA1234F1Z5")
    pan: Optional[str] = Field(None, min_length=10, max_length=10, example="AABCA1234F")
    state_code: str = Field(..., example="27")
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", example="billing@apexenterprise.com")
    phone: str = Field(..., example="+91 22 2345 6789")
    invoice_prefix: str = Field(default="APX-26/", example="APX-26/")
    is_composition_scheme: bool = Field(default=False)
    address: AddressSchema
    bank_details: Optional[BankDetailsSchema] = None


class BusinessProfileCreate(BusinessProfileBase):
    pass


class BusinessProfileUpdate(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state_code: Optional[str] = None
    email: Optional[str] = Field(None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: Optional[str] = None
    invoice_prefix: Optional[str] = None
    is_composition_scheme: Optional[bool] = None
    address: Optional[AddressSchema] = None
    bank_details: Optional[BankDetailsSchema] = None


class BusinessProfileResponse(BusinessProfileBase):
    id: str = Field(..., example="biz_001")
    state_name: str = Field(..., example="Maharashtra")
    created_at: str
    updated_at: str


class GSTStateResponse(BaseModel):
    code: str
    name: str


# In-memory session store (default business initialized for Compliance One)
_CURRENT_BUSINESS: Dict[str, Any] = {
    "id": "biz_001",
    "legal_name": "Apex Enterprise Private Limited",
    "trade_name": "Apex Tools & Hardware",
    "gstin": "27AABCA1234F1Z5",
    "pan": "AABCA1234F",
    "state_code": "27",
    "email": "billing@apexenterprise.com",
    "phone": "+91 22 2345 6789",
    "invoice_prefix": "APX-26/",
    "is_composition_scheme": False,
    "address": {
        "street": "Plot No. 42, MIDC Industrial Area, Andheri East",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400093",
    },
    "bank_details": {
        "bank_name": "HDFC Bank Ltd",
        "account_number": "50200098765432",
        "ifsc_code": "HDFC0000240",
        "branch_name": "MIDC Andheri Branch",
        "upi_id": "apexenterprise@hdfcbank",
    },
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-11-10T08:00:00Z",
}


@router.get("", response_model=BusinessProfileResponse, summary="Get active business profile")
def get_business_profile():
    """Returns the current active business profile and GST setup."""
    state_name = GST_STATE_CODES.get(
        _CURRENT_BUSINESS["state_code"], "Unknown State"
    )
    return {**_CURRENT_BUSINESS, "state_name": state_name}


@router.post("", response_model=BusinessProfileResponse, status_code=status.HTTP_201_CREATED, summary="Create or onboard business")
def create_business_profile(payload: BusinessProfileCreate):
    """Initializes or updates the business profile."""
    state_code = normalize_state_code(payload.state_code)
    pan = payload.pan or payload.gstin[2:12]

    _CURRENT_BUSINESS.update(
        {
            "legal_name": payload.legal_name,
            "trade_name": payload.trade_name or payload.legal_name,
            "gstin": payload.gstin.upper(),
            "pan": pan.upper(),
            "state_code": state_code,
            "email": str(payload.email),
            "phone": payload.phone,
            "invoice_prefix": payload.invoice_prefix,
            "is_composition_scheme": payload.is_composition_scheme,
            "address": payload.address.model_dump(),
            "bank_details": payload.bank_details.model_dump() if payload.bank_details else None,
            "updated_at": "2026-11-10T08:30:00Z",
        }
    )
    state_name = GST_STATE_CODES.get(state_code, "Unknown State")
    return {**_CURRENT_BUSINESS, "state_name": state_name}


@router.put("", response_model=BusinessProfileResponse, summary="Update business profile")
def update_business_profile(payload: BusinessProfileUpdate):
    """Partially updates active business information."""
    update_data = payload.model_dump(exclude_unset=True)

    if "gstin" in update_data and update_data["gstin"]:
        update_data["gstin"] = update_data["gstin"].upper()
        if "pan" not in update_data:
            update_data["pan"] = update_data["gstin"][2:12]

    if "state_code" in update_data and update_data["state_code"]:
        update_data["state_code"] = normalize_state_code(update_data["state_code"])

    if "address" in update_data and update_data["address"]:
        _CURRENT_BUSINESS["address"] = update_data["address"]
        del update_data["address"]

    if "bank_details" in update_data and update_data["bank_details"]:
        _CURRENT_BUSINESS["bank_details"] = update_data["bank_details"]
        del update_data["bank_details"]

    _CURRENT_BUSINESS.update(update_data)
    _CURRENT_BUSINESS["updated_at"] = "2026-11-10T08:30:00Z"

    state_name = GST_STATE_CODES.get(
        _CURRENT_BUSINESS["state_code"], "Unknown State"
    )
    return {**_CURRENT_BUSINESS, "state_name": state_name}


@router.get("/states", response_model=List[GSTStateResponse], summary="List all GST State Codes")
def list_gst_states():
    """Returns the official 2-digit Indian GST State & Union Territory codes."""
    return [{"code": k, "name": v} for k, v in sorted(GST_STATE_CODES.items())]


@router.get("/verify-gstin/{gstin}", summary="Validate and parse Indian GSTIN")
def verify_gstin(gstin: str):
    """
    Validates a 15-character Indian Goods and Services Tax Identification Number (GSTIN).
    Structure: [State Code 2 digits][PAN 10 chars][Entity 1 char][Default 'Z'][Checksum 1 char]
    """
    clean_gstin = gstin.strip().upper()
    gstin_pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"

    if not re.match(gstin_pattern, clean_gstin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid GSTIN format: '{clean_gstin}'. Must match pattern 22AAAAA0000A1Z5.",
        )

    state_code = clean_gstin[:2]
    pan = clean_gstin[2:12]
    state_name = GST_STATE_CODES.get(state_code, "Unmapped Territory")

    return {
        "gstin": clean_gstin,
        "is_valid": True,
        "state_code": state_code,
        "state_name": state_name,
        "pan": pan,
        "entity_type": "Company" if pan[3] == "C" else "Individual/Proprietor" if pan[3] == "P" else "Firm/LLP" if pan[3] == "F" else "Other",
    }

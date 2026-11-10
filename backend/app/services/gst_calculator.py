"""
GST Calculation Engine for Compliance One.
Implements Indian Goods and Services Tax (GST) rules under Section 7 & 8 of the IGST Act, 2017:
- Intra-State Supply (Seller State == Buyer State): CGST (50% of tax rate) + SGST (50% of tax rate)
- Inter-State Supply (Seller State != Buyer State): IGST (100% of tax rate)
- Precise rounding using Decimal (ROUND_HALF_UP) to prevent floating-point inaccuracies.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

# Standard 2-digit Indian GST State / UT Codes
GST_STATE_CODES: Dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
}


def _round_currency(val: Decimal) -> Decimal:
    """Rounds a Decimal value to two decimal places using standard financial round-half-up."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class GSTCalculationResult(BaseModel):
    """Structured breakdown of GST computation for an item."""
    item_price: float = Field(..., description="Unit price before tax")
    quantity: int = Field(..., description="Quantity of units")
    discount_percent: float = Field(default=0.0, description="Percentage discount applied to gross")
    gross_amount: float = Field(..., description="Gross item value before discount")
    discount_amount: float = Field(..., description="Discount deducted from gross")
    taxable_amount: float = Field(..., description="Taxable base value")
    
    # State & Classification
    seller_state_code: str = Field(..., description="Seller 2-digit GST state code")
    buyer_state_code: str = Field(..., description="Buyer 2-digit GST state code")
    is_inter_state: bool = Field(..., description="True if IGST applies, False if CGST+SGST")
    
    # Tax Rates & Breakdowns
    tax_rate: float = Field(..., description="Total applicable GST rate % (e.g. 18.0)")
    cgst_rate: float = Field(default=0.0, description="Central GST rate %")
    cgst_amount: float = Field(default=0.0, description="Central GST monetary amount")
    sgst_rate: float = Field(default=0.0, description="State/UT GST rate %")
    sgst_amount: float = Field(default=0.0, description="State/UT GST monetary amount")
    igst_rate: float = Field(default=0.0, description="Integrated GST rate %")
    igst_amount: float = Field(default=0.0, description="Integrated GST monetary amount")
    
    total_tax_amount: float = Field(..., description="Sum of all applicable GST taxes")
    total_amount: float = Field(..., description="Final line total including taxable value and GST")


class InvoiceTaxSummary(BaseModel):
    """Aggregated tax summary for an entire invoice."""
    total_taxable_amount: float
    total_cgst_amount: float
    total_sgst_amount: float
    total_igst_amount: float
    total_tax_amount: float
    subtotal: float
    round_off: float
    grand_total: float
    is_inter_state: bool
    items_count: int


def normalize_state_code(code: str) -> str:
    """Sanitizes and normalizes state code to a zero-padded 2-character string."""
    clean = str(code).strip()
    if len(clean) == 1:
        clean = f"0{clean}"
    return clean.zfill(2)[:2]


def calculate_gst(
    item_price: float,
    quantity: int,
    tax_rate: float,
    seller_state_code: str,
    buyer_state_code: str,
    discount_percent: float = 0.0,
) -> GSTCalculationResult:
    """
    Computes GST according to Indian tax regulations.
    
    :param item_price: Unit selling price (exclusive of tax)
    :param quantity: Unit quantity
    :param tax_rate: GST Slab rate in percentage (e.g. 0.0, 5.0, 12.0, 18.0, 28.0)
    :param seller_state_code: 2-digit state code of the seller / supplier
    :param buyer_state_code: 2-digit state code of the buyer / place of supply
    :param discount_percent: Optional trade discount percentage
    :return: GSTCalculationResult with complete tax breakdown
    """
    seller_code = normalize_state_code(seller_state_code)
    buyer_code = normalize_state_code(buyer_state_code)
    
    price_dec = Decimal(str(item_price))
    qty_dec = Decimal(str(quantity))
    tax_rate_dec = Decimal(str(tax_rate))
    disc_rate_dec = Decimal(str(discount_percent))
    
    # 1. Gross and Discount
    gross_dec = _round_currency(price_dec * qty_dec)
    discount_dec = _round_currency(gross_dec * (disc_rate_dec / Decimal("100")))
    taxable_dec = gross_dec - discount_dec
    if taxable_dec < Decimal("0.00"):
        taxable_dec = Decimal("0.00")
        
    is_inter_state = seller_code != buyer_code

    cgst_rate = Decimal("0.0")
    cgst_amt = Decimal("0.00")
    sgst_rate = Decimal("0.0")
    sgst_amt = Decimal("0.00")
    igst_rate = Decimal("0.0")
    igst_amt = Decimal("0.00")

    if is_inter_state:
        # Inter-State: 100% IGST
        igst_rate = tax_rate_dec
        igst_amt = _round_currency(taxable_dec * (igst_rate / Decimal("100")))
    else:
        # Intra-State: 50% CGST + 50% SGST
        half_rate = tax_rate_dec / Decimal("2")
        cgst_rate = half_rate
        sgst_rate = half_rate
        cgst_amt = _round_currency(taxable_dec * (cgst_rate / Decimal("100")))
        sgst_amt = _round_currency(taxable_dec * (sgst_rate / Decimal("100")))

    total_tax_dec = cgst_amt + sgst_amt + igst_amt
    total_amount_dec = taxable_dec + total_tax_dec

    return GSTCalculationResult(
        item_price=float(price_dec),
        quantity=int(quantity),
        discount_percent=float(disc_rate_dec),
        gross_amount=float(gross_dec),
        discount_amount=float(discount_dec),
        taxable_amount=float(taxable_dec),
        seller_state_code=seller_code,
        buyer_state_code=buyer_code,
        is_inter_state=is_inter_state,
        tax_rate=float(tax_rate_dec),
        cgst_rate=float(cgst_rate),
        cgst_amount=float(cgst_amt),
        sgst_rate=float(sgst_rate),
        sgst_amount=float(sgst_amt),
        igst_rate=float(igst_rate),
        igst_amount=float(igst_amt),
        total_tax_amount=float(total_tax_dec),
        total_amount=float(total_amount_dec),
    )


def calculate_invoice_totals(
    items: List[Dict[str, Any]],
    seller_state_code: str,
    buyer_state_code: str,
) -> InvoiceTaxSummary:
    """
    Calculates aggregate taxable value, taxes, round-off, and grand total for a multi-line invoice.
    
    Each item dict must contain:
    - 'unit_price' or 'item_price': float
    - 'quantity': int
    - 'tax_rate': float
    - Optional 'discount_percent': float
    """
    total_taxable = Decimal("0.00")
    total_cgst = Decimal("0.00")
    total_sgst = Decimal("0.00")
    total_igst = Decimal("0.00")

    seller_code = normalize_state_code(seller_state_code)
    buyer_code = normalize_state_code(buyer_state_code)
    is_inter_state = seller_code != buyer_code

    for it in items:
        price = float(it.get("unit_price") or it.get("item_price", 0.0))
        qty = int(it.get("quantity", 1))
        rate = float(it.get("tax_rate", 18.0))
        disc = float(it.get("discount_percent", 0.0))

        res = calculate_gst(
            item_price=price,
            quantity=qty,
            tax_rate=rate,
            seller_state_code=seller_code,
            buyer_state_code=buyer_code,
            discount_percent=disc,
        )

        total_taxable += Decimal(str(res.taxable_amount))
        total_cgst += Decimal(str(res.cgst_amount))
        total_sgst += Decimal(str(res.sgst_amount))
        total_igst += Decimal(str(res.igst_amount))

    total_tax = total_cgst + total_sgst + total_igst
    subtotal = total_taxable + total_tax

    # Round off to nearest whole rupee per standard Indian accounting
    rounded_grand = subtotal.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    round_off = rounded_grand - subtotal

    return InvoiceTaxSummary(
        total_taxable_amount=float(total_taxable),
        total_cgst_amount=float(total_cgst),
        total_sgst_amount=float(total_sgst),
        total_igst_amount=float(total_igst),
        total_tax_amount=float(total_tax),
        subtotal=float(subtotal),
        round_off=float(round_off),
        grand_total=float(rounded_grand),
        is_inter_state=is_inter_state,
        items_count=len(items),
    )


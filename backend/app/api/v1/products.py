"""
Product Catalog & Inventory Management API Router.
Provides complete CRUD, HSN/GST classification, search, and stock level tracking.
"""

from typing import List, Optional, Dict, Any
from enum import Enum
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/products", tags=["Product Catalog"])


class GSTTaxSlab(float, Enum):
    ZERO = 0.0
    FIVE = 5.0
    TWELVE = 12.0
    EIGHTEEN = 18.0
    TWENTY_EIGHT = 28.0


class StockAdjustmentType(str, Enum):
    STOCK_IN = "STOCK_IN"
    STOCK_OUT = "STOCK_OUT"
    DAMAGE = "DAMAGE"
    AUDIT_CORRECTION = "AUDIT_CORRECTION"


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, example="Heavy Duty Industrial Ball Valve 2 Inch")
    sku: Optional[str] = Field(None, example="VLV-BRS-02")
    hsn_code: str = Field(..., min_length=2, max_length=8, example="84818030")
    category: str = Field(default="General", example="Plumbing")
    unit: str = Field(default="PCS", example="PCS")
    selling_price: float = Field(..., gt=0, example=1250.0)
    purchase_price: float = Field(default=0.0, ge=0, example=950.0)
    tax_rate: float = Field(default=18.0, example=18.0)
    current_stock: int = Field(default=0, ge=0, example=45)
    min_stock_level: int = Field(default=5, ge=0, example=10)
    is_active: bool = Field(default=True)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    selling_price: Optional[float] = None
    purchase_price: Optional[float] = None
    tax_rate: Optional[float] = None
    current_stock: Optional[int] = None
    min_stock_level: Optional[int] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: str
    is_low_stock: bool
    created_at: str
    updated_at: str


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total_count: int
    page: int
    page_size: int


class StockAdjustPayload(BaseModel):
    adjustment_type: StockAdjustmentType
    quantity_change: int = Field(..., example=10)
    reason: str = Field(..., example="Purchase receipt from vendor")


# Initial In-Memory Products Database
_PRODUCTS_DB: Dict[str, Dict[str, Any]] = {
    "prod_1": {
        "id": "prod_1",
        "name": "Heavy Duty Industrial Ball Valve 2 Inch",
        "sku": "VLV-BRS-02",
        "hsn_code": "84818030",
        "category": "Plumbing",
        "unit": "PCS",
        "selling_price": 1250.0,
        "purchase_price": 950.0,
        "tax_rate": 18.0,
        "current_stock": 45,
        "min_stock_level": 10,
        "is_active": True,
        "created_at": "2026-01-15T10:00:00Z",
        "updated_at": "2026-11-09T14:00:00Z",
    },
    "prod_2": {
        "id": "prod_2",
        "name": "UltraTech Super Cement (50kg Bag)",
        "sku": "CMT-ULT-50",
        "hsn_code": "25232900",
        "category": "Building Materials",
        "unit": "BAG",
        "selling_price": 380.0,
        "purchase_price": 330.0,
        "tax_rate": 28.0,
        "current_stock": 120,
        "min_stock_level": 30,
        "is_active": True,
        "created_at": "2026-02-10T11:00:00Z",
        "updated_at": "2026-11-08T16:00:00Z",
    },
    "prod_3": {
        "id": "prod_3",
        "name": "Havells Modular Switch 10A 1-Way",
        "sku": "SW-HAV-10A",
        "hsn_code": "85365020",
        "category": "Electricals",
        "unit": "PCS",
        "selling_price": 140.0,
        "purchase_price": 95.0,
        "tax_rate": 18.0,
        "current_stock": 8,
        "min_stock_level": 25,
        "is_active": True,
        "created_at": "2026-03-01T09:00:00Z",
        "updated_at": "2026-11-07T12:00:00Z",
    },
}


def _to_response(item: Dict[str, Any]) -> ProductResponse:
    return ProductResponse(
        **item,
        is_low_stock=item["current_stock"] <= item["min_stock_level"],
    )


@router.get("", response_model=ProductListResponse, summary="List products with filters and search")
def list_products(
    search: Optional[str] = Query(None, description="Search by name, SKU, or HSN"),
    category: Optional[str] = Query(None, description="Filter by category"),
    low_stock_only: bool = Query(False, description="Filter only items below min reorder level"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    results = [p for p in _PRODUCTS_DB.values() if p["is_active"]]

    if search:
        q = search.lower().strip()
        results = [
            p
            for p in results
            if q in p["name"].lower() or q in p["sku"].lower() or q in p["hsn_code"]
        ]

    if category and category != "All":
        results = [p for p in results if p["category"].lower() == category.lower()]

    if low_stock_only:
        results = [p for p in results if p["current_stock"] <= p["min_stock_level"]]

    total = len(results)
    start = (page - 1) * page_size
    paged = results[start : start + page_size]

    return ProductListResponse(
        items=[_to_response(p) for p in paged],
        total_count=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{product_id}", response_model=ProductResponse, summary="Get product details")
def get_product(product_id: str):
    product = _PRODUCTS_DB.get(product_id)
    if not product or not product["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _to_response(product)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create new product")
def create_product(payload: ProductCreate):
    sku = payload.sku or f"SKU-{len(_PRODUCTS_DB) + 1001}"
    prod_id = f"prod_{len(_PRODUCTS_DB) + 1}"

    new_prod = {
        "id": prod_id,
        "name": payload.name,
        "sku": sku,
        "hsn_code": payload.hsn_code,
        "category": payload.category,
        "unit": payload.unit.upper(),
        "selling_price": payload.selling_price,
        "purchase_price": payload.purchase_price,
        "tax_rate": payload.tax_rate,
        "current_stock": payload.current_stock,
        "min_stock_level": payload.min_stock_level,
        "is_active": True,
        "created_at": "2026-11-10T08:30:00Z",
        "updated_at": "2026-11-10T08:30:00Z",
    }
    _PRODUCTS_DB[prod_id] = new_prod
    return _to_response(new_prod)


@router.put("/{product_id}", response_model=ProductResponse, summary="Update product details")
def update_product(product_id: str, payload: ProductUpdate):
    product = _PRODUCTS_DB.get(product_id)
    if not product or not product["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_dict = payload.model_dump(exclude_unset=True)
    if "unit" in update_dict and update_dict["unit"]:
        update_dict["unit"] = update_dict["unit"].upper()

    product.update(update_dict)
    product["updated_at"] = "2026-11-10T08:35:00Z"

    return _to_response(product)


@router.delete("/{product_id}", summary="Soft delete product")
def delete_product(product_id: str):
    product = _PRODUCTS_DB.get(product_id)
    if not product or not product["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product["is_active"] = False
    product["updated_at"] = "2026-11-10T08:35:00Z"
    return {"message": f"Product '{product['name']}' has been deactivated successfully."}


@router.post("/{product_id}/stock-adjust", response_model=ProductResponse, summary="Adjust inventory level")
def adjust_product_stock(product_id: str, payload: StockAdjustPayload):
    product = _PRODUCTS_DB.get(product_id)
    if not product or not product["is_active"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    qty = payload.quantity_change
    if payload.adjustment_type == StockAdjustmentType.STOCK_IN:
        product["current_stock"] += qty
    elif payload.adjustment_type in (StockAdjustmentType.STOCK_OUT, StockAdjustmentType.DAMAGE):
        if product["current_stock"] < qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reduce {qty}. Available stock is only {product['current_stock']}.",
            )
        product["current_stock"] -= qty
    elif payload.adjustment_type == StockAdjustmentType.AUDIT_CORRECTION:
        product["current_stock"] = qty

    product["updated_at"] = "2026-11-10T08:35:00Z"
    return _to_response(product)


@router.get("/meta/categories", response_model=List[str], summary="Get list of all product categories")
def get_categories():
    categories = sorted(list({p["category"] for p in _PRODUCTS_DB.values() if p["is_active"]}))
    return categories


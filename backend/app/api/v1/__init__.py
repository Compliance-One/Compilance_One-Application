"""
API v1 package router aggregator.
"""

from fastapi import APIRouter
from app.api.v1.business import router as business_router
from app.api.v1.products import router as products_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.payments import router as payments_router
from app.api.v1.expenses import router as expenses_router
from app.api.v1.suppliers import router as suppliers_router

api_v1_router = APIRouter(prefix="/v1")
api_v1_router.include_router(business_router)
api_v1_router.include_router(products_router)
api_v1_router.include_router(invoices_router)
api_v1_router.include_router(payments_router)
api_v1_router.include_router(expenses_router)
api_v1_router.include_router(suppliers_router)

__all__ = ["api_v1_router"]


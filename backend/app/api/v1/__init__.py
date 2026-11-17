"""
API v1 package router aggregator.
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.v1.auth import router as auth_router
from app.api.v1.business import router as business_router
from app.api.v1.products import router as products_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.payments import router as payments_router
from app.api.v1.expenses import router as expenses_router
from app.api.v1.suppliers import router as suppliers_router
from app.api.v1.reports import router as reports_router
from app.api.v1.gstr1 import router as gstr1_router
from app.api.v1.customers_ledger import router as customers_ledger_router

api_v1_router = APIRouter(prefix="/v1")
api_v1_router.include_router(auth_router)

# In-memory Member 3 routers: require a valid access token.
_protected = APIRouter(dependencies=[Depends(get_current_user)])
_protected.include_router(business_router)
_protected.include_router(products_router)
_protected.include_router(invoices_router)
_protected.include_router(payments_router)
_protected.include_router(expenses_router)
_protected.include_router(suppliers_router)
api_v1_router.include_router(_protected)

# Postgres-backed business-scoped routers: each endpoint also checks ownership.
api_v1_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_v1_router.include_router(gstr1_router, prefix="/gstr1", tags=["GSTR-1"])
api_v1_router.include_router(customers_ledger_router, prefix="/customers-ledger", tags=["Customer Ledger"])

__all__ = ["api_v1_router"]

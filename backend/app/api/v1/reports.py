"""
Reports endpoints — P&L (VPL) and Balance Sheet (VBS) over a date range,
plus a dashboard summary. Thin layer: real aggregation logic lives in
services/report_aggregator.py so it's reusable by excel_export.py too.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db  # TODO: confirm with Member 1
from app.core.security import get_current_business_id  # TODO: confirm with Member 2
from app.services.report_aggregator import (
    get_profit_and_loss,
    get_balance_sheet,
    get_dashboard_summary,
)

router = APIRouter(prefix="/reports", tags=["reports"])


class ProfitAndLoss(BaseModel):
    period_from: date
    period_to: date
    total_income: float
    total_expense: float
    net_profit: float
    income_by_category: dict[str, float]
    expense_by_category: dict[str, float]


class BalanceSheet(BaseModel):
    business_id: UUID
    cash_and_bank: float
    stock_value: float
    receivables: float
    payables: float
    owners_capital: float
    note: str = (
        "cash_and_bank is currently always 0 — no cash/bank ledger exists "
        "in the schema yet. Flag this before presenting real figures."
    )


class DashboardSummary(BaseModel):
    period_from: date
    period_to: date
    total_sales: float
    total_invoices: int
    taxable_amount: float
    total_gst: float
    cgst: float
    sgst: float
    igst: float


@router.get("/profit-loss", response_model=ProfitAndLoss)
def profit_and_loss(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    return get_profit_and_loss(db, business_id, from_date, to_date)


@router.get("/balance-sheet", response_model=BalanceSheet)
def balance_sheet(
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    return get_balance_sheet(db, business_id)


@router.get("/dashboard-summary", response_model=DashboardSummary)
def dashboard_summary(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    business_id: UUID = Depends(get_current_business_id),
):
    return get_dashboard_summary(db, business_id, from_date, to_date)

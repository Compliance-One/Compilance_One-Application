import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.report_aggregator import (
    get_profit_and_loss,
    get_balance_sheet,
    get_dashboard_summary,
)
from app.services.excel_export import build_financial_statements_xlsx

router = APIRouter()


class ProfitAndLoss(BaseModel):
    period_from: date
    period_to: date
    total_income: float
    total_expense: float
    net_profit: float
    income_by_category: dict[str, float]
    expense_by_category: dict[str, float]


class BalanceSheet(BaseModel):
    business_id: uuid.UUID
    cash_and_bank: float
    stock_value: float
    receivables: float
    payables: float
    owners_capital: float


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
async def profit_and_loss(
    business_id: uuid.UUID = Query(...),
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await get_profit_and_loss(db, business_id, from_date, to_date)


@router.get("/balance-sheet", response_model=BalanceSheet)
async def balance_sheet(
    business_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await get_balance_sheet(db, business_id)


@router.get("/dashboard-summary", response_model=DashboardSummary)
async def dashboard_summary(
    business_id: uuid.UUID = Query(...),
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await get_dashboard_summary(db, business_id, from_date, to_date)


@router.get("/export/excel")
async def export_excel(
    business_id: uuid.UUID = Query(...),
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    pl = await get_profit_and_loss(db, business_id, from_date, to_date)
    bs = await get_balance_sheet(db, business_id)
    xlsx_bytes = build_financial_statements_xlsx(pl, bs)

    filename = f"statements_{from_date}_{to_date}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

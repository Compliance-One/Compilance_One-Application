"""
Async aggregation logic shared by reports.py and the Excel export route,
so the download and the in-app reports can never show different numbers.
"""

import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_profit_and_loss(
    db: AsyncSession, business_id: uuid.UUID, from_date: date, to_date: date
) -> dict:
    income_result = await db.execute(
        text(
            """
            SELECT category, SUM(amount) AS total
            FROM v_pl_income_entries
            WHERE business_id = :business_id
              AND entry_date BETWEEN :from_date AND :to_date
            GROUP BY category
            """
        ),
        {"business_id": str(business_id), "from_date": from_date, "to_date": to_date},
    )
    income_rows = income_result.mappings().all()

    expense_result = await db.execute(
        text(
            """
            SELECT category, SUM(amount) AS total
            FROM v_pl_expense_entries
            WHERE business_id = :business_id
              AND entry_date BETWEEN :from_date AND :to_date
            GROUP BY category
            """
        ),
        {"business_id": str(business_id), "from_date": from_date, "to_date": to_date},
    )
    expense_rows = expense_result.mappings().all()

    income_by_category = {r["category"]: float(r["total"]) for r in income_rows}
    expense_by_category = {r["category"]: float(r["total"] or 0) for r in expense_rows}
    total_income = sum(income_by_category.values())
    total_expense = sum(expense_by_category.values())

    return {
        "period_from": from_date,
        "period_to": to_date,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": total_income - total_expense,
        "income_by_category": income_by_category,
        "expense_by_category": expense_by_category,
    }


async def get_balance_sheet(db: AsyncSession, business_id: uuid.UUID) -> dict:
    result = await db.execute(
        text(
            """
            SELECT business_id, cash_and_bank, stock_value, receivables,
                   payables, owners_capital
            FROM v_balance_sheet
            WHERE business_id = :business_id
            """
        ),
        {"business_id": str(business_id)},
    )
    row = result.mappings().first()
    if row is None:
        # Business has no products/ledger activity yet, or doesn't exist —
        # return a zeroed statement instead of raising.
        return {
            "business_id": business_id,
            "cash_and_bank": 0,
            "stock_value": 0,
            "receivables": 0,
            "payables": 0,
            "owners_capital": 0,
        }
    return dict(row)


async def get_dashboard_summary(
    db: AsyncSession, business_id: uuid.UUID, from_date: date, to_date: date
) -> dict:
    result = await db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total_invoices,
                COALESCE(SUM(total_amount), 0) AS total_sales,
                COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
                COALESCE(SUM(cgst_amount), 0) AS cgst,
                COALESCE(SUM(sgst_amount), 0) AS sgst,
                COALESCE(SUM(igst_amount), 0) AS igst
            FROM invoices
            WHERE business_id = :business_id
              AND invoice_date BETWEEN :from_date AND :to_date
            """
        ),
        {"business_id": str(business_id), "from_date": from_date, "to_date": to_date},
    )
    row = result.mappings().one()

    return {
        "period_from": from_date,
        "period_to": to_date,
        "total_sales": float(row["total_sales"]),
        "total_invoices": row["total_invoices"],
        "taxable_amount": float(row["taxable_amount"]),
        "total_gst": float(row["cgst"]) + float(row["sgst"]) + float(row["igst"]),
        "cgst": float(row["cgst"]),
        "sgst": float(row["sgst"]),
        "igst": float(row["igst"]),
    }

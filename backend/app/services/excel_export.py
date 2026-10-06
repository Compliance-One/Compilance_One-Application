"""
Excel export for P&L and Balance Sheet, using the same numbers the app
screens show (via report_aggregator) so the download never disagrees
with the in-app reports.
"""

from datetime import date
from io import BytesIO
from uuid import UUID

from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy.orm import Session

from app.services.report_aggregator import get_profit_and_loss, get_balance_sheet

BOLD = Font(bold=True)


def export_financial_statements_xlsx(
    db: Session, business_id: UUID, from_date: date, to_date: date
) -> bytes:
    pl = get_profit_and_loss(db, business_id, from_date, to_date)
    bs = get_balance_sheet(db, business_id)

    wb = Workbook()

    # ---- P&L sheet ----
    ws_pl = wb.active
    ws_pl.title = "Profit and Loss"
    ws_pl.append(["Profit & Loss", f"{from_date} to {to_date}"])
    ws_pl["A1"].font = BOLD
    ws_pl.append([])
    ws_pl.append(["Income by category"])
    ws_pl["A4"].font = BOLD
    for category, amount in pl["income_by_category"].items():
        ws_pl.append([category, amount])
    ws_pl.append(["Total income", pl["total_income"]])
    ws_pl.append([])
    ws_pl.append(["Expense by category"])
    for category, amount in pl["expense_by_category"].items():
        ws_pl.append([category, amount])
    ws_pl.append(["Total expense", pl["total_expense"]])
    ws_pl.append([])
    ws_pl.append(["Net profit", pl["net_profit"]])
    ws_pl["A" + str(ws_pl.max_row)].font = BOLD

    # ---- Balance sheet ----
    ws_bs = wb.create_sheet("Balance Sheet")
    ws_bs.append(["Balance Sheet"])
    ws_bs["A1"].font = BOLD
    ws_bs.append([])
    ws_bs.append(["Cash & bank", bs["cash_and_bank"], "(not yet tracked — see schema note)"])
    ws_bs.append(["Stock value", bs["stock_value"]])
    ws_bs.append(["Receivables", bs["receivables"]])
    ws_bs.append(["Payables", bs["payables"]])
    ws_bs.append(["Owner's capital", bs["owners_capital"]])

    for ws in (ws_pl, ws_bs):
        ws.column_dimensions["A"].width = 28
        ws.column_dimensions["B"].width = 18

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()

import io
from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from app.core.database import get_db
from app.core.auth import require_role
from app.models.part import Part
from app.models.stock import StockLevel
from app.models.inquiry import Inquiry
from app.models.user import User

router = APIRouter(prefix="/export", tags=["export"])

HEADER_FILL = PatternFill("solid", fgColor="F5A623")
HEADER_FONT = Font(bold=True, color="000000")


def _make_xlsx_response(wb: openpyxl.Workbook, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/inquiries")
async def export_inquiries(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("group_leader", "admin", "supplier")),
):
    result = await db.execute(
        select(Inquiry)
        .order_by(desc(Inquiry.created_at))
        .limit(1000)
    )
    inquiries = result.scalars().all()
    for inq in inquiries:
        await db.refresh(inq, ["submitter"])

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inquiry Kelas G"

    headers = ["ID", "Tanggal", "Part", "Part Number", "Qty", "Unit", "Tanggal Butuh",
               "Diajukan", "Status", "Catatan UT", "Alasan Tolak"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center")

    for row_idx, inq in enumerate(inquiries, 2):
        ws.cell(row=row_idx, column=1, value=inq.id)
        ws.cell(row=row_idx, column=2, value=inq.created_at.strftime("%d/%m/%Y") if inq.created_at else "")
        ws.cell(row=row_idx, column=3, value=inq.part_name)
        ws.cell(row=row_idx, column=4, value=inq.part_number or "")
        ws.cell(row=row_idx, column=5, value=inq.qty_needed)
        ws.cell(row=row_idx, column=6, value=inq.unit_asset or "")
        ws.cell(row=row_idx, column=7, value=str(inq.date_needed) if inq.date_needed else "")
        ws.cell(row=row_idx, column=8, value=inq.submitter.name if inq.submitter else "")
        ws.cell(row=row_idx, column=9, value=inq.status.upper())
        ws.cell(row=row_idx, column=10, value=inq.supplier_notes or "")
        ws.cell(row=row_idx, column=11, value=inq.rejection_reason or "")

    for col in ws.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 50)

    today = date.today().strftime("%Y%m%d")
    return _make_xlsx_response(wb, f"inquiry_export_{today}.xlsx")


@router.get("/stock-report")
async def export_stock_report(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    latest_date_result = await db.execute(select(func.max(StockLevel.snapshot_date)))
    latest_date = latest_date_result.scalar_one_or_none()

    result = await db.execute(
        select(Part, StockLevel)
        .outerjoin(
            StockLevel,
            (Part.id == StockLevel.part_id)
            & (StockLevel.site == "AGMR")
            & (StockLevel.snapshot_date == (latest_date or date.today())),
        )
        .where(Part.is_active == True, Part.kelas == "V")
        .order_by(Part.part_number)
    )
    rows = result.all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Stok {latest_date or 'N/A'}"

    headers = ["Part Number", "Deskripsi", "Produsen", "Komoditi", "RTT", "TBD", "Total", "MIN", "MAX", "Status"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center")

    for row_idx, (part, stock) in enumerate(rows, 2):
        ws.cell(row=row_idx, column=1, value=part.part_number)
        ws.cell(row=row_idx, column=2, value=part.description or "")
        ws.cell(row=row_idx, column=3, value=part.producer or "")
        ws.cell(row=row_idx, column=4, value=part.commodity or "")
        ws.cell(row=row_idx, column=5, value=stock.rtt_qty if stock else 0)
        ws.cell(row=row_idx, column=6, value=stock.tbd_qty if stock else 0)
        ws.cell(row=row_idx, column=7, value=(stock.rtt_qty + stock.tbd_qty) if stock else 0)
        ws.cell(row=row_idx, column=8, value=float(stock.min_qty) if stock else 0)
        ws.cell(row=row_idx, column=9, value=float(stock.max_qty) if stock else 0)
        ws.cell(row=row_idx, column=10, value=stock.status if stock else "N/A")

    for col in ws.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

    today = date.today().strftime("%Y%m%d")
    return _make_xlsx_response(wb, f"stok_agmr_{today}.xlsx")

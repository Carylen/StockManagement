import asyncio
from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.scoping import require_view_inquiries, require_view_sites
from app.models.stock import StockLevel
from app.models.inquiry import Inquiry
from app.services.excel_templates import build_inquiry_export, build_stock_export, XLSX_MIME

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/inquiries")
async def export_inquiries(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_inquiries),
):
    result = await db.execute(
        select(Inquiry)
        .order_by(desc(Inquiry.created_at))
        .limit(1000)
    )
    inquiries = result.scalars().all()

    rows = [
        {
            "created_at": inq.created_at.strftime("%d/%m/%Y") if inq.created_at else "",
            "submitter_name": inq.submitter.name if inq.submitter else "",
            "submitter_nrp": (inq.submitter.nrp if inq.submitter else "") or "",
            "site": inq.site,
            "part_number": item.part_number,
            "part_name": item.part_name or "",
            "qty": item.qty,
            "status": item.status.upper(),
            "ut_note": item.ut_note or "",
            "replacement_pn": item.replacement_pn or "",
        }
        for inq in inquiries
        for item in inq.items
    ]

    buf = await asyncio.to_thread(build_inquiry_export, rows)
    today = date.today().strftime("%Y%m%d")
    return StreamingResponse(
        buf,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="inquiry_export_{today}.xlsx"'},
    )


@router.get("/stock-report")
async def export_stock_report(
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_sites),
):
    result = await db.execute(
        select(StockLevel)
        .where(StockLevel.site == current_user.site)
        .order_by(StockLevel.part_number)
    )
    stocks = result.scalars().all()

    rows = [
        {
            "part_number": s.part_number,
            "description": s.description or "",
            "commodity": s.commodity or "",
            "rtt_qty": s.rtt_qty or 0,
            "tbd_qty": s.tbd_qty or 0,
            "total_qty": (s.rtt_qty or 0) + (s.tbd_qty or 0),
            "min_qty": float(s.min_qty) if s.min_qty is not None else 0,
            "max_qty": float(s.max_qty) if s.max_qty is not None else 0,
            "status": s.status or "",
            "estimated_date": s.estimated_date.strftime("%d/%m/%Y") if s.estimated_date else "",
        }
        for s in stocks
    ]

    buf = await asyncio.to_thread(build_stock_export, rows, current_user.site)
    today = date.today().strftime("%Y%m%d")
    return StreamingResponse(
        buf,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="stok_{current_user.site}_{today}.xlsx"'},
    )

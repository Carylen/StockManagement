import asyncio
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.scoping import require_view_inquiries, require_view_sites, resolve_site, maybe_supplier_sites
from app.models.site import Site
from app.models.inquiry import Inquiry
from app.services.excel_templates import build_inquiry_export, build_stock_export, XLSX_MIME
from app.services.readiness_service import get_readiness
from app.routers.inquiries import _apply_inquiry_scope

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/inquiries")
async def export_inquiries(
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    site: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_inquiries),
    supplier_sites: list[str] | None = Depends(maybe_supplier_sites),
):
    """Export inquiries matching the same filters/scope as GET /inquiries — whatever
    is currently applied on screen, unbounded (no artificial row cap) since it's
    already scoped to what the caller is allowed to see."""
    query = select(Inquiry).order_by(desc(Inquiry.created_at))
    query = _apply_inquiry_scope(
        query, current_user, supplier_sites,
        status=status, approval_status=approval_status, site=site,
        from_date=from_date, to_date=to_date,
    )
    inquiries = (await db.execute(query)).scalars().all() if query is not None else []

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


async def _resolve_export_sites(
    principal: Principal,
    requested_site: Optional[str],
    supplier_sites: list[str] | None,
    db: AsyncSession,
) -> list[str]:
    """Which site(s) a stock-report export should cover.

    - supplier: a specific requested site if it's in their assignment, else all
      their assigned sites (no request = "everything you can see").
    - non-supplier: resolve_site()'s single site, or — for an all-sites principal
      with no ?site — every active site (same "everything you can see" rule).
    """
    if supplier_sites is not None:
        if not supplier_sites:
            return []
        requested = requested_site.upper() if requested_site else None
        if requested:
            return [requested] if requested in supplier_sites else []
        return supplier_sites

    site_code = resolve_site(principal, requested_site)
    if site_code is not None:
        return [site_code]
    result = await db.execute(select(Site.code).where(Site.is_active == True))
    return list(result.scalars().all())


@router.get("/stock-report")
async def export_stock_report(
    site: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    producer: Optional[str] = None,
    commodity: Optional[str] = None,
    kelas: str = "V",
    db: AsyncSession = Depends(get_db),
    current_user: Principal = Depends(require_view_sites),
    supplier_sites: list[str] | None = Depends(maybe_supplier_sites),
):
    """Export the same merged Admin+UT readiness view the Catalog page shows,
    with the same filters — one or more sites depending on scope/selection."""
    site_codes = await _resolve_export_sites(current_user, site, supplier_sites, db)

    rows: list[dict] = []
    for site_code in site_codes:
        site_rows, _total = await get_readiness(
            site_code, db,
            kelas=kelas, status_filter=status, search=search,
            producer=producer, commodity=commodity,
            page=1, limit=100_000,
        )
        for r in site_rows:
            rows.append({
                "site": site_code,
                "part_number": r.part_number,
                "description": r.description or "",
                "commodity": r.commodity or "",
                "rtt_qty": r.rtt_qty or 0,
                "tbd_qty": r.tbd_qty or 0,
                "total_qty": r.avail_stock if r.avail_stock is not None else 0,
                "min_qty": r.min_qty,
                "max_qty": r.max_qty,
                "status": r.status,
                "estimated_date": r.estimated_date.strftime("%d/%m/%Y") if r.estimated_date else "",
            })

    label = site_codes[0] if len(site_codes) == 1 else "ALL"
    title = f"Stok {label}" if len(site_codes) == 1 else "Stok Semua Site"

    buf = await asyncio.to_thread(build_stock_export, rows, title)
    today = date.today().strftime("%Y%m%d")
    return StreamingResponse(
        buf,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="stok_{label}_{today}.xlsx"'},
    )

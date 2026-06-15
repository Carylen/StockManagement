import asyncio
import io
import math
import os
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission, require_any_permission
from app.models.plan_period import PlanPeriod
from app.models.plan_line import PlanLine
from app.models.plan_line_history import PlanLineHistory
from app.models.permission import SupplierSite
from app.schemas.plan import (
    PlanUploadResponse, PeriodListItem, PlanLineOut, PaginatedLines, FillRequest,
    OverviewResponse, AchievementResponse, ReqDateUpdate, HistoryItem, FillImportResult,
)
from app.services.plan_service import (
    process_plan_upload, period_state, aggregate_period, record_history, parse_fill_file,
)
from app.utils.scoping import has_all_sites

router = APIRouter(prefix="/scheduled-plans", tags=["scheduled-plans"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
FILL_IMPORT_EXTENSIONS = {".xlsx", ".xls", ".csv"}

_HEADER_FILL = PatternFill("solid", fgColor="E8A323")
_HEADER_FONT = Font(bold=True, color="000000")


async def _supplier_period_or_403(period_id: str, principal: Principal, db: AsyncSession) -> PlanPeriod:
    """Load a period and ensure the supplier is assigned to its site."""
    period = (await db.execute(select(PlanPeriod).where(PlanPeriod.id == period_id))).scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")
    assigned = (await db.execute(
        select(SupplierSite.id).where(
            SupplierSite.supplier_id == principal.id,
            SupplierSite.site_code == period.site,
        )
    )).scalar_one_or_none()
    if assigned is None:
        raise HTTPException(status_code=403, detail="Site tidak ter-assign ke supplier ini")
    return period


def _check_extension(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS


async def _get_period_scoped(period_id: str, principal: Principal, db: AsyncSession) -> PlanPeriod:
    """Load a period and enforce site scoping (own-site unless can_view_all_sites)."""
    period = (await db.execute(select(PlanPeriod).where(PlanPeriod.id == period_id))).scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")
    if not has_all_sites(principal) and period.site != principal.site:
        raise HTTPException(status_code=403, detail="Periode di luar scope site Anda")
    return period


# ── 3.1 Upload (Planner) ─────────────────────────────────────────────────
@router.post("/upload", response_model=PlanUploadResponse)
async def upload_plan(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_scheduled_plan")),
):
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Hanya file XLSX yang diterima")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File kosong")

    summary = await process_plan_upload(
        file_bytes=file_bytes,
        filename=file.filename or "plan.xlsx",
        uploader_id=principal.id,
        uploader_site=principal.site,
        all_sites=has_all_sites(principal),
        db=db,
    )
    await db.commit()
    return PlanUploadResponse(**vars(summary))


# ── 3.2 List periods (Planner / Admin) ───────────────────────────────────
@router.get("/periods", response_model=list[PeriodListItem])
async def list_periods(
    site: str | None = None,
    activity: str | None = None,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_any_permission(
        "can_manage_scheduled_plan", "can_view_plan_achievement", "can_fill_scheduled_plan")),
):
    q = select(PlanPeriod)
    if site:
        q = q.where(PlanPeriod.site == site)
    if activity:
        q = q.where(PlanPeriod.activity == activity)

    # fill-only supplier sees only periods for sites assigned to them
    perms = principal.permissions
    if "can_manage_scheduled_plan" not in perms and "can_view_plan_achievement" not in perms:
        assigned = (await db.execute(
            select(SupplierSite.site_code).where(SupplierSite.supplier_id == principal.id)
        )).scalars().all()
        q = q.where(PlanPeriod.site.in_(assigned or ["__none__"]))
    q = q.order_by(PlanPeriod.start_date.desc()).offset((page - 1) * limit).limit(limit)
    periods = (await db.execute(q)).scalars().all()

    if not periods:
        return []

    # live readiness aggregation (ignore removed lines)
    agg = await db.execute(
        select(
            PlanLine.period_id,
            func.count().label("total"),
            func.sum(case((PlanLine.is_ready.is_(True), 1), else_=0)).label("ready"),
        )
        .where(
            PlanLine.period_id.in_([p.id for p in periods]),
            PlanLine.removed_in_revision.is_(False),
        )
        .group_by(PlanLine.period_id)
    )
    stats = {row.period_id: (int(row.total), int(row.ready or 0)) for row in agg}

    out = []
    for p in periods:
        total, ready = stats.get(p.id, (0, 0))
        pct = round(ready / total * 100, 1) if total else 0.0
        out.append(PeriodListItem(
            period_id=p.id, site=p.site, activity=p.activity,
            start_date=p.start_date, due_date=p.due_date,
            state=period_state(p.due_date),
            readiness_pct=pct, total_lines=total,
        ))
    return out


# ── 3.3 List lines of a period (Planner) ─────────────────────────────────
@router.get("/periods/{period_id}/lines", response_model=PaginatedLines)
async def list_lines(
    period_id: str,
    apl_activity: str | None = None,
    status: str | None = Query(None, pattern="^(READY|NOT_READY)$"),
    include_removed: bool = False,
    page: int = 1,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: Principal = Depends(require_permission("can_manage_scheduled_plan")),
):
    period = (await db.execute(select(PlanPeriod).where(PlanPeriod.id == period_id))).scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")

    base = select(PlanLine).where(PlanLine.period_id == period_id)
    if not include_removed:
        base = base.where(PlanLine.removed_in_revision.is_(False))
    if apl_activity:
        base = base.where(PlanLine.apl_activity == apl_activity)
    if status:
        base = base.where(PlanLine.status == status)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one() or 0
    rows = (await db.execute(
        base.order_by(PlanLine.apl_activity, PlanLine.egi, PlanLine.cn, PlanLine.npn)
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    return PaginatedLines(
        items=[PlanLineOut.model_validate(r) for r in rows],
        total=total, page=page, limit=limit,
        pages=math.ceil(total / limit) if total else 1,
    )


# ── 3.5 Fill list (UT/Supplier) ──────────────────────────────────────────
@router.get("/fill", response_model=PaginatedLines)
async def list_fill_lines(
    period_id: str,
    apl_activity: str | None = None,
    status: str | None = Query(None, pattern="^(READY|NOT_READY)$"),
    page: int = 1,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_fill_scheduled_plan")),
):
    period = (await db.execute(select(PlanPeriod).where(PlanPeriod.id == period_id))).scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")

    assigned = (await db.execute(
        select(SupplierSite.id).where(
            SupplierSite.supplier_id == principal.id,
            SupplierSite.site_code == period.site,
        )
    )).scalar_one_or_none()
    if assigned is None:
        raise HTTPException(status_code=403, detail="Site tidak ter-assign ke supplier ini")

    base = select(PlanLine).where(
        PlanLine.period_id == period_id,
        PlanLine.removed_in_revision.is_(False),
    )
    if apl_activity:
        base = base.where(PlanLine.apl_activity == apl_activity)
    if status:
        base = base.where(PlanLine.status == status)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one() or 0
    rows = (await db.execute(
        base.order_by(PlanLine.apl_activity, PlanLine.egi, PlanLine.cn, PlanLine.npn)
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    return PaginatedLines(
        items=[PlanLineOut.model_validate(r) for r in rows],
        total=total, page=page, limit=limit,
        pages=math.ceil(total / limit) if total else 1,
    )


# ── 3.5 Fill by UT/Supplier ──────────────────────────────────────────────
@router.patch("/lines/{line_id}/fill", response_model=PlanLineOut)
async def fill_line(
    line_id: str,
    body: FillRequest,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_fill_scheduled_plan")),
):
    line = (await db.execute(select(PlanLine).where(PlanLine.id == line_id))).scalar_one_or_none()
    if line is None:
        raise HTTPException(status_code=404, detail="Baris tidak ditemukan")

    period = (await db.execute(select(PlanPeriod).where(PlanPeriod.id == line.period_id))).scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")

    if period_state(period.due_date) == "LOCKED":
        raise HTTPException(status_code=403, detail="Periode sudah LOCKED, tidak bisa diubah")

    # supplier must be assigned to the period's site
    assigned = (await db.execute(
        select(SupplierSite.id).where(
            SupplierSite.supplier_id == principal.id,
            SupplierSite.site_code == period.site,
        )
    )).scalar_one_or_none()
    if assigned is None:
        raise HTTPException(status_code=403, detail="Site tidak ter-assign ke supplier ini")

    # audit field-level changes before mutating
    record_history(db, line.id, "status", line.status, body.status, principal.id)
    record_history(db, line.id, "ut_location", line.ut_location, body.ut_location, principal.id)
    record_history(db, line.id, "est_date", line.est_date, body.est_date, principal.id)

    line.status = body.status
    line.ut_location = body.ut_location
    line.est_date = body.est_date
    line.is_ready = (body.status == "READY")  # always re-derived from status
    line.updated_by = principal.id

    await db.commit()
    await db.refresh(line)
    return PlanLineOut.model_validate(line)


# ── 3.6a Export fill template (UT/Supplier) ──────────────────────────────
@router.get("/fill/export")
async def export_fill(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_fill_scheduled_plan")),
):
    period = await _supplier_period_or_403(period_id, principal, db)

    rows = (await db.execute(
        select(PlanLine)
        .where(PlanLine.period_id == period_id, PlanLine.removed_in_revision.is_(False))
        .order_by(PlanLine.apl_activity, PlanLine.egi, PlanLine.cn, PlanLine.npn)
    )).scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Fill"
    headers = ["Line ID", "NPN", "Description", "APL Activity", "Req Qty",
               "Status", "UT Location", "Est Date"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(horizontal="center")

    for i, ln in enumerate(rows, 2):
        ws.cell(row=i, column=1, value=ln.id)
        ws.cell(row=i, column=2, value=ln.npn)
        ws.cell(row=i, column=3, value=ln.description or "")
        ws.cell(row=i, column=4, value=ln.apl_activity)
        ws.cell(row=i, column=5, value=float(ln.req_qty) if ln.req_qty is not None else 0)
        ws.cell(row=i, column=6, value=ln.status)
        ws.cell(row=i, column=7, value=ln.ut_location or "")
        ws.cell(row=i, column=8, value=ln.est_date.strftime("%d/%m/%Y") if ln.est_date else "")

    # Lock the identity columns visually (note row at the top is overkill; keep simple).
    for col_cells in ws.columns:
        width = max((len(str(c.value or "")) for c in col_cells), default=10)
        ws.column_dimensions[col_cells[0].column_letter].width = min(width + 4, 45)
    ws.freeze_panes = "A2"

    buf = io.BytesIO()
    await asyncio.to_thread(wb.save, buf)
    buf.seek(0)
    fname = f"fill_{period.activity}_{period.site}_{date.today():%Y%m%d}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ── 3.6b Import filled file (UT/Supplier) ────────────────────────────────
@router.post("/fill/import", response_model=FillImportResult)
async def import_fill(
    period_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_fill_scheduled_plan")),
):
    _, ext = os.path.splitext((file.filename or "").lower())
    if ext not in FILL_IMPORT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Hanya file XLSX atau CSV yang diterima")

    period = await _supplier_period_or_403(period_id, principal, db)
    if period_state(period.due_date) == "LOCKED":
        raise HTTPException(status_code=403, detail="Periode sudah LOCKED, tidak bisa diubah")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File kosong")

    parsed = await asyncio.to_thread(parse_fill_file, file_bytes, file.filename or "fill.xlsx")
    if parsed["error"]:
        raise HTTPException(status_code=422, detail=parsed["error"])

    # index this period's live lines by id
    lines = (await db.execute(
        select(PlanLine).where(
            PlanLine.period_id == period_id,
            PlanLine.removed_in_revision.is_(False),
        )
    )).scalars().all()
    by_id = {ln.id: ln for ln in lines}

    updated = 0
    skipped = 0
    errors: list[dict] = list(parsed["errors"])
    for r in parsed["rows"]:
        line = by_id.get(r.line_id)
        if line is None:
            skipped += 1
            errors.append({"line_id": r.line_id, "reason": "Line ID tidak ada di periode ini"})
            continue
        changed = False
        changed |= record_history(db, line.id, "status", line.status, r.status, principal.id)
        changed |= record_history(db, line.id, "ut_location", line.ut_location, r.ut_location, principal.id)
        changed |= record_history(db, line.id, "est_date", line.est_date, r.est_date, principal.id)
        line.status = r.status
        line.ut_location = r.ut_location
        line.est_date = r.est_date
        line.is_ready = (r.status == "READY")
        line.updated_by = principal.id
        if changed:
            updated += 1
        else:
            skipped += 1

    await db.commit()
    return FillImportResult(updated=updated, skipped=skipped, errors=errors)


# ── 3.4 Edit req_date (Planner) ──────────────────────────────────────────
@router.patch("/lines/{line_id}", response_model=PlanLineOut)
async def edit_req_date(
    line_id: str,
    body: ReqDateUpdate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_scheduled_plan")),
):
    line = (await db.execute(select(PlanLine).where(PlanLine.id == line_id))).scalar_one_or_none()
    if line is None:
        raise HTTPException(status_code=404, detail="Baris tidak ditemukan")

    period = await _get_period_scoped(line.period_id, principal, db)
    if period_state(period.due_date) == "LOCKED":
        raise HTTPException(status_code=403, detail="Periode sudah LOCKED, tidak bisa diubah")

    record_history(db, line.id, "req_date", line.req_date, body.req_date, principal.id)
    line.req_date = body.req_date
    line.updated_by = principal.id

    await db.commit()
    await db.refresh(line)
    return PlanLineOut.model_validate(line)


# ── Line history (audit trail) ───────────────────────────────────────────
@router.get("/lines/{line_id}/history", response_model=list[HistoryItem])
async def line_history(
    line_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_any_permission(
        "can_manage_scheduled_plan", "can_view_plan_achievement")),
):
    line = (await db.execute(select(PlanLine).where(PlanLine.id == line_id))).scalar_one_or_none()
    if line is None:
        raise HTTPException(status_code=404, detail="Baris tidak ditemukan")
    await _get_period_scoped(line.period_id, principal, db)  # site scope guard

    rows = (await db.execute(
        select(PlanLineHistory)
        .where(PlanLineHistory.line_id == line_id)
        .order_by(PlanLineHistory.changed_at.desc())
    )).scalars().all()
    return [HistoryItem.model_validate(r) for r in rows]


# ── 3.7 Overview (Planner) ───────────────────────────────────────────────
@router.get("/overview", response_model=OverviewResponse)
async def plan_overview(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_manage_scheduled_plan")),
):
    period = await _get_period_scoped(period_id, principal, db)
    agg = await aggregate_period(db, period)
    return OverviewResponse(period_id=period.id, activities=[agg])


# ── 3.8 Achievement (Admin Site) ─────────────────────────────────────────
@router.get("/achievement", response_model=AchievementResponse)
async def plan_achievement(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_view_plan_achievement")),
):
    period = await _get_period_scoped(period_id, principal, db)
    agg = await aggregate_period(db, period)
    not_ready = [a for a in agg["apl_activities"] if a["pct"] < 100]
    return AchievementResponse(
        period_id=period.id,
        activities=[{
            "activity": agg["activity"],
            "readiness_pct": agg["readiness_pct"],
            "ready": agg["ready"],
            "total": agg["total"],
            "not_ready_apl_activities": not_ready,
        }],
    )

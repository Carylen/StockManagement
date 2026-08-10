import math
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import Principal
from app.utils.permissions import require_permission
from app.utils.scoping import has_all_sites
from app.models.upload_log import UploadLog
from app.models.ut_stock import UTUploadLog
from app.models.plant_site_mapping import PlantSiteMapping
from app.models.site import Site
from app.schemas.plant_site_mapping import PlantMappingCreate
from app.services.ut_stock_service import validate_ut_stock_upload, process_ut_stock_upload

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _check_extension(filename: str) -> bool:
    import os
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS


@router.post("/validate")
async def validate_upload():
    """Deprecated — readiness kini diupload oleh UT/Supplier via /upload/ut-stock/validate."""
    raise HTTPException(
        status_code=410,
        detail="Endpoint deprecated. Readiness kini diupload oleh UT/Supplier via POST /upload/ut-stock/validate.",
    )


@router.post("/publish")
async def publish_upload():
    """Deprecated — readiness kini diupload oleh UT/Supplier via /upload/ut-stock/publish."""
    raise HTTPException(
        status_code=410,
        detail="Endpoint deprecated. Readiness kini diupload oleh UT/Supplier via POST /upload/ut-stock/publish.",
    )


@router.get("/logs")
async def list_upload_logs(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_admin_stock")),
):
    """Admin's own upload history — site-scoped unless the account can see all sites."""
    from app.models.user import User

    filters = []
    if not has_all_sites(principal):
        filters.append(UploadLog.site == principal.site)

    count_result = await db.execute(select(func.count(UploadLog.id)).where(*filters))
    total = count_result.scalar_one() or 0

    result = await db.execute(
        select(UploadLog, User)
        .join(User, User.id == UploadLog.uploaded_by)
        .where(*filters)
        .order_by(UploadLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

    return {
        "items": [
            {
                "id": log.id,
                "filename": log.filename,
                "site": log.site,
                "uploaded_by": log.uploaded_by,
                "uploader_name": user.name if user else None,
                "rows_total": log.rows_total,
                "rows_processed": log.rows_processed,
                "rows_skipped": log.rows_skipped,
                "rows_error": log.rows_error,
                "error_detail": log.error_detail,
                "status": log.status,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log, user in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


# ---------------------------------------------------------------------------
# UT Stock upload endpoints (for UT/Supplier role)
# ---------------------------------------------------------------------------

@router.post("/ut-stock/validate")
async def validate_ut_stock(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    """Dry-run: parse file, cross-reference with master KPP, return preview without saving."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    parse_result, preview = await validate_ut_stock_upload(
        file_bytes, file.filename or "upload.xlsx", db
    )

    if parse_result.has_errors:
        raise HTTPException(status_code=422, detail=parse_result.errors[0]["reason"])

    return {
        "filename": file.filename,
        "total_rows": preview.total_rows,
        "matched_rows": preview.matched_rows,
        "skipped_rows": preview.skipped_rows,
        "sites_affected": preview.sites_affected,
        "warnings": preview.warnings,
        "preview": preview.preview,
    }


@router.post("/ut-stock/publish")
async def publish_ut_stock(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    """Full upload: parse → resolve → replace existing stock data → save log."""
    if not _check_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are accepted")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    summary = await process_ut_stock_upload(
        file_bytes=file_bytes,
        filename=file.filename or "upload.xlsx",
        uploader_id=principal.id,
        supplier_id=principal.id,
        db=db,
    )

    return {
        "batch_id": summary.batch_id,
        "total_rows": summary.total_rows,
        "matched_rows": summary.matched_rows,
        "skipped_rows": summary.skipped_rows,
        "sites_affected": summary.sites_affected,
        "warnings": summary.warnings,
    }


@router.get("/ut-stock/logs")
async def list_ut_stock_logs(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    """Supplier's own UT stock upload history, newest first — every holder of
    can_upload_readiness is a supplier account, so this scopes to their own
    uploads the same way /upload/logs scopes admin uploads to their site."""
    from app.models.user import User

    count_result = await db.execute(
        select(func.count(UTUploadLog.id)).where(UTUploadLog.supplier_id == principal.id)
    )
    total = count_result.scalar_one() or 0

    result = await db.execute(
        select(UTUploadLog, User)
        .join(User, User.id == UTUploadLog.uploaded_by, isouter=True)
        .where(UTUploadLog.supplier_id == principal.id)
        .order_by(UTUploadLog.uploaded_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

    return {
        "items": [
            {
                "id": log.id,
                "batch_id": log.batch_id,
                "filename": log.filename,
                "uploaded_by": log.uploaded_by,
                "uploader_name": user.name if user else None,
                "total_rows": log.total_rows,
                "matched_rows": log.matched_rows,
                "skipped_rows": log.skipped_rows,
                "sites_affected": log.sites_affected,
                "uploaded_at": log.uploaded_at.isoformat() if log.uploaded_at else None,
            }
            for log, user in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


# ---------------------------------------------------------------------------
# Supplier self-service plant-site mapping — the allow-list _fetch_lookup_data()
# validates uploads against. Every can_upload_readiness holder is a supplier
# account, so these endpoints are always scoped to the caller's own rows.
# ---------------------------------------------------------------------------

@router.get("/plant-mapping")
async def list_my_plant_mapping(
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    result = await db.execute(
        select(PlantSiteMapping)
        .where(PlantSiteMapping.supplier_id == principal.id)
        .order_by(PlantSiteMapping.plnt_code, PlantSiteMapping.site_code)
    )
    rows = result.scalars().all()
    return [
        {
            "plnt_code": r.plnt_code,
            "site_code": r.site_code,
            "supplier_id": r.supplier_id,
            "description": r.description,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/plant-mapping", status_code=201)
async def create_my_plant_mapping(
    data: PlantMappingCreate,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    plnt_code = data.plnt_code.strip().upper()
    site_code = data.site_code.strip().upper()
    if not plnt_code or not site_code:
        raise HTTPException(status_code=400, detail="plnt_code and site_code are required")

    site = (await db.execute(select(Site).where(Site.code == site_code))).scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site {site_code} not found")

    existing = (await db.execute(
        select(PlantSiteMapping).where(
            PlantSiteMapping.plnt_code == plnt_code,
            PlantSiteMapping.supplier_id == principal.id,
            PlantSiteMapping.site_code == site_code,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Mapping {plnt_code} → {site_code} already exists")

    mapping = PlantSiteMapping(
        plnt_code=plnt_code,
        supplier_id=principal.id,
        site_code=site_code,
        description=data.description,
    )
    db.add(mapping)
    await db.flush()
    return {"plnt_code": plnt_code, "site_code": site_code}


@router.delete("/plant-mapping/{plnt_code}/{site_code}", status_code=204)
async def delete_my_plant_mapping(
    plnt_code: str,
    site_code: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_readiness")),
):
    result = await db.execute(
        select(PlantSiteMapping).where(
            PlantSiteMapping.plnt_code == plnt_code.upper(),
            PlantSiteMapping.supplier_id == principal.id,
            PlantSiteMapping.site_code == site_code.upper(),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await db.delete(row)
    await db.flush()


# ---------------------------------------------------------------------------
# Existing readiness upload log endpoints (admin)
# ---------------------------------------------------------------------------

@router.get("/logs/{log_id}")
async def get_upload_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permission("can_upload_admin_stock")),
):
    from app.models.user import User

    result = await db.execute(
        select(UploadLog, User)
        .join(User, User.id == UploadLog.uploaded_by)
        .where(UploadLog.id == log_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Log not found")

    log, user = row
    if not has_all_sites(principal) and log.site != principal.site:
        raise HTTPException(status_code=404, detail="Log not found")

    return {
        "id": log.id,
        "filename": log.filename,
        "site": log.site,
        "uploaded_by": log.uploaded_by,
        "uploader_name": user.name if user else None,
        "rows_total": log.rows_total,
        "rows_processed": log.rows_processed,
        "rows_skipped": log.rows_skipped,
        "rows_error": log.rows_error,
        "error_detail": log.error_detail,
        "status": log.status,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }

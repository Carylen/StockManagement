"""App settings catalog — HO-editable business-tuning values.

Single source of truth for which keys exist and their defaults (mirrors the
role/permission catalog in app.core.rbac). Values are stored as text in
tb_m_app_settings and cast to int here; a missing row (e.g. right after a
fresh migration, before HO ever touches it) falls back to DEFAULTS so callers
never need to special-case an unseeded key.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting

DEFAULTS: dict[str, int] = {
    "plan_attention_relevance_days": 14,
    "plan_attention_lock_warning_days": 7,
}


async def get_settings(db: AsyncSession) -> dict[str, int]:
    rows = (await db.execute(select(AppSetting))).scalars().all()
    values = {r.key: r.value for r in rows}
    return {key: int(values.get(key, default)) for key, default in DEFAULTS.items()}


async def set_settings(db: AsyncSession, values: dict[str, int], *, updated_by: str) -> dict[str, int]:
    unknown = set(values) - set(DEFAULTS)
    if unknown:
        raise ValueError(f"Unknown setting keys: {sorted(unknown)}")

    now = datetime.now(timezone.utc)
    existing = {
        r.key: r for r in (await db.execute(select(AppSetting))).scalars().all()
    }
    for key, value in values.items():
        row = existing.get(key)
        if row is None:
            db.add(AppSetting(key=key, value=str(value), updated_at=now, updated_by=updated_by))
        else:
            row.value = str(value)
            row.updated_at = now
            row.updated_by = updated_by
    await db.flush()

    return await get_settings(db)

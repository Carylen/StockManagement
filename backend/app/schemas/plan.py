from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, field_validator


class PeriodUploadResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    period_id: str
    activity: str
    is_revision: bool
    rows_inserted: int
    rows_updated: int
    rows_merged: int
    rows_marked_removed: int


class SkippedPeriod(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    activity: str
    reason: str


class PlanUploadResponse(BaseModel):
    site: str
    start_date: date
    due_date: date
    rows_total: int
    # aggregate counts across all processed periods
    rows_inserted: int
    rows_updated: int
    rows_merged: int
    rows_skipped: int
    rows_marked_removed: int
    periods: List[PeriodUploadResult] = []
    skipped_periods: List[SkippedPeriod] = []
    errors: List[dict] = []


class PeriodListItem(BaseModel):
    period_id: str
    site: str
    activity: str
    start_date: date
    due_date: date
    state: str
    readiness_pct: float
    total_lines: int


class PlanLineOut(BaseModel):
    id: str
    egi: str
    cn: str
    apl_activity: str
    npn: str
    description: Optional[str] = None
    req_qty: float
    req_date: Optional[date] = None
    status: str
    ut_location: Optional[str] = None
    est_date: Optional[date] = None
    is_ready: bool
    removed_in_revision: bool

    model_config = {"from_attributes": True}

    @field_validator("req_qty", mode="before")
    @classmethod
    def _qty(cls, v):
        return float(v) if v is not None else 0.0


class PaginatedLines(BaseModel):
    items: List[PlanLineOut]
    total: int
    page: int
    limit: int
    pages: int


class FillRequest(BaseModel):
    status: Literal["READY", "NOT_READY"]
    ut_location: Optional[str] = None
    est_date: Optional[date] = None


class ReqDateUpdate(BaseModel):
    req_date: Optional[date] = None


class FillImportResult(BaseModel):
    updated: int
    skipped: int
    errors: List[dict] = []


class HistoryItem(BaseModel):
    id: str
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Overview / Achievement (read model) ──────────────────────────────────

class AplStat(BaseModel):
    apl_activity: str
    ready: int
    total: int
    pct: float


class ActivityOverview(BaseModel):
    activity: str
    readiness_pct: float
    ready: int
    total: int
    apl_activities: List[AplStat]


class OverviewResponse(BaseModel):
    period_id: str
    activities: List[ActivityOverview]


class ActivityAchievement(BaseModel):
    activity: str
    readiness_pct: float
    ready: int
    total: int
    not_ready_apl_activities: List[AplStat]


class AchievementResponse(BaseModel):
    period_id: str
    activities: List[ActivityAchievement]

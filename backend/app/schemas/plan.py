from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, field_validator


class MergeResult(BaseModel):
    """Result of merging an Excel file's rows into one event/period."""
    rows_total: int
    rows_inserted: int
    rows_updated: int
    rows_merged: int
    errors: List[dict] = []


class PeriodListItem(BaseModel):
    period_id: str
    site: str
    name: str
    start_date: date
    due_date: date
    state: str
    readiness_pct: Optional[float] = None  # admin-only (can_view_plan_achievement)
    total_lines: int


class EventCreateResult(BaseModel):
    """Response for admin's create-event(+baseline-upload) action."""
    period: PeriodListItem
    merge: MergeResult


class CarryoverEventCreateResult(BaseModel):
    """Response for admin's carryover-based event creation (no file upload)."""
    period: PeriodListItem
    lines_carried_over: int


class PlanLineCreateRequest(BaseModel):
    """Manual single-line add (admin → BASELINE, planner → EXTRA)."""
    activity: str
    apl_activity: str
    egi: str
    cn: str
    npn: str
    description: Optional[str] = None
    req_qty: float
    req_date: Optional[date] = None


class PlanLineOut(BaseModel):
    id: str
    activity: str
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
    origin: str
    is_ready: bool
    removed_in_revision: bool
    # collaboration / concurrency transparency
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    at_risk: bool = False
    needs_planner_revision: bool = False
    # carryover lineage (DELTA3) — planner sees count as read-only badge
    carryover_count: int = 0
    carried_over_from_line_id: Optional[str] = None
    is_cancelled: bool = False
    carryover_override: bool = False

    model_config = {"from_attributes": True}

    @field_validator("req_qty", mode="before")
    @classmethod
    def _qty(cls, v):
        return float(v) if v is not None else 0.0


# ── Carryover / transition (DELTA3) ──────────────────────────────────────────

class EventCarryoverCreateRequest(BaseModel):
    """Admin creates a new event by carrying lines from a LOCKED source event.
    No file upload — lines are cloned from carry_over_from_event_id."""
    name: str
    start_date: date
    due_date: date
    site: Optional[str] = None
    carry_over_from_event_id: Optional[str] = None


class BlockerItem(BaseModel):
    line_id: str
    origin: str
    reason: Literal["FIRST_TIME_EXTRA", "THRESHOLD_REACHED"]
    egi: str
    cn: str
    apl_activity: str
    npn: str
    carryover_count: int


class TransitionBlockersResponse(BaseModel):
    event_id: Optional[str] = None  # None means "aggregated across all LOCKED events"
    blockers: List[BlockerItem]
    total: int


class CancelLineRequest(BaseModel):
    reason: str


class CarryoverOverrideRequest(BaseModel):
    note: Optional[str] = None


# ── Collaboration (computed-on-read) ─────────────────────────────────────

class CoordinationItem(BaseModel):
    apl_activity: str
    coordination_status: str  # READY | NEEDS_PLANNER_REVISION | SUPPLIER_RESPONDED | AWAITING_SUPPLIER
    readiness_pct: float
    unread_for_me: int
    at_risk_count: int
    needs_revision_count: int
    last_revision_no: Optional[int] = None
    last_revision_at: Optional[datetime] = None


class RevisionLineInput(BaseModel):
    line_id: str
    req_date: Optional[date] = None


class RevisionRequest(BaseModel):
    apl_activity: str
    note: Optional[str] = None
    lines: List[RevisionLineInput]


class RevisionResponse(BaseModel):
    revision_no: int
    updated_lines: int


class SeenRequest(BaseModel):
    apl_activity: str


class PaginatedLines(BaseModel):
    items: List[PlanLineOut]
    total: int
    page: int
    limit: int
    pages: int


class FillRequest(BaseModel):
    """Supplier fill input — readiness is derived from ut_location, not a
    separate status field (see plan_collaboration_service.derive_readiness)."""
    ut_location: Optional[str] = None
    est_date: Optional[date] = None


class FillImportResult(BaseModel):
    updated: int
    skipped: int
    errors: List[dict] = []
    end_date: Optional[date] = None
    days_remaining: Optional[int] = None


# ── Upload preview/diff session (DELTA3 section A) ───────────────────────

class UploadDiffSummary(BaseModel):
    inserted: int
    updated: int
    marked_removed: int = 0  # this system's merge is additive — always 0 today
    errors: List[dict] = []


class UploadPreviewRow(BaseModel):
    action: str  # INSERT | UPDATE
    egi: str
    cn: str
    apl_activity: str
    npn: str
    description: Optional[str] = None
    req_qty: float
    req_date: Optional[date] = None


class UploadSessionResult(BaseModel):
    session_id: str
    summary: UploadDiffSummary
    rows_preview: List[UploadPreviewRow]


# ── Attention digest (DELTA3 section C) ───────────────────────────────────

class AttentionItem(BaseModel):
    type: str
    period_id: str
    period_name: str
    site: str
    apl_activity: Optional[str] = None
    count: Optional[int] = None
    days_remaining: Optional[int] = None
    link: str


class AttentionResponse(BaseModel):
    items: List[AttentionItem]


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

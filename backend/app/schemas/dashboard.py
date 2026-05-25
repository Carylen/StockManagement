from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class StatusCount(BaseModel):
    WARNING: int = 0
    AMAN: int = 0
    OVER: int = 0
    MAX: int = 0


class ReadynessMetrics(BaseModel):
    oh_pct: float = 0.0
    min_pct: float = 0.0
    fb_pct: float = 0.0


class DashboardSummary(BaseModel):
    site: str
    last_updated: Optional[datetime]
    total_parts: int
    status_count: StatusCount
    readyness: ReadynessMetrics


class StockLatestItem(BaseModel):
    part_number: str
    description: Optional[str]
    producer: Optional[str]
    commodity: Optional[str]
    rtt_qty: int
    tbd_qty: int
    estimated_qty: int
    min_qty: float
    max_qty: float
    status: Optional[str]
    snapshot_date: Optional[str]
    updated_at: Optional[datetime]


class InquiryPendingCount(BaseModel):
    count: int
    role_label: str


class InquiryStatusCounts(BaseModel):
    pending: int = 0
    valid: int = 0
    invalid: int = 0
    total: int = 0


class InquiryPulseItem(BaseModel):
    date: str
    count: int

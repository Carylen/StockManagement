from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel


class StockInfo(BaseModel):
    rtt_qty: int
    tbd_qty: int
    total_qty: int
    min_qty: float
    max_qty: float
    status: Optional[str]
    estimated_date: Optional[date] = None

    model_config = {"from_attributes": True}


class PartResponse(BaseModel):
    """Detail view — from tb_m_parts + tb_t_ut_stock."""
    id: str
    part_number: str
    description: Optional[str]
    producer: Optional[str]
    commodity: Optional[str]
    kelas: str
    is_active: bool
    min_qty: float = 0.0
    max_qty: float = 0.0
    superseded_by: Optional[str] = None
    current_stock: Optional[StockInfo] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartListResponse(BaseModel):
    """Catalog list — data from tb_m_parts + tb_t_ut_stock (on-the-fly readiness)."""
    part_number: str
    description: Optional[str]
    mnemonic: Optional[str] = None
    commodity: Optional[str]
    producer: Optional[str] = None
    kelas: Optional[str] = None
    min_qty: Optional[float] = None
    max_qty: Optional[float] = None
    avail_stock: Optional[float] = None
    last_uploaded_at: Optional[datetime] = None
    status: Optional[str] = None
    is_fallback: bool = False

    model_config = {"from_attributes": True}


class PaginatedParts(BaseModel):
    items: List[PartListResponse]
    total: int
    page: int
    limit: int
    pages: int


class StockHistoryItem(BaseModel):
    id: str
    warehouse: str
    old_qty: Optional[int]
    new_qty: int
    delta: int
    source_file: Optional[str]
    synced_at: datetime

    model_config = {"from_attributes": True}
